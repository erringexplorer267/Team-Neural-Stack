from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
import json
import re
import pandas as pd
import io
import uuid
from fairlearn.metrics import MetricFrame, selection_rate
from langchain_utils import generate_bias_narrative, analyze_hidden_correlations
from dotenv import load_dotenv

from pydantic import BaseModel
from typing import List

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="Neural Stack API")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost",
    "http://127.0.0.1",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/")
async def read_root():
    return {"message": "Neural Stack API"}


@app.options("/")
async def options_root():
    return {}


@app.options("/upload")
async def options_upload():
    return {}


@app.options("/analyze")
async def options_analyze():
    return {}


@app.options("/narrative")
async def options_narrative():
    return {}


@app.options("/agent-reasoning")
async def options_agent_reasoning():
    return {}


@app.options("/simulate-mitigation")
async def options_simulate_mitigation():
    return {}


@app.options("/report")
async def options_report():
    return {}


# Simple in-memory store for uploaded dataframes (session-less dev)
DATAFRAMES: Dict[str, pd.DataFrame] = {}


@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not (file.filename.endswith(".csv") or file.content_type in ("text/csv", "application/vnd.ms-excel")):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {exc}")

    # Build response metadata
    columns = list(df.columns)
    dtypes = {col: str(dtype) for col, dtype in df.dtypes.items()}

    keywords = ["race", "gender", "age", "zip", "ethnicity"]
    potential_sensitive = [col for col in columns if any(k in col.lower() for k in keywords)]

    # store dataframe in global dict with a generated id
    data_id = str(uuid.uuid4())
    DATAFRAMES[data_id] = df

    return {
        "id": data_id,
        "columns": columns,
        "dtypes": dtypes,
        "potential_sensitive_attributes": potential_sensitive,
    }


def compute_fairness_metrics(df: pd.DataFrame, target_column: str, sensitive_column: str, privileged_value: Any = None) -> Dict[str, Any]:
    if target_column not in df.columns:
        raise ValueError(f"target_column '{target_column}' not found in dataframe")
    if sensitive_column not in df.columns:
        raise ValueError(f"sensitive_column '{sensitive_column}' not found in dataframe")

    # use Fairlearn's selection_rate via MetricFrame
    y = df[target_column]
    s = df[sensitive_column]

    mf = MetricFrame(metrics=selection_rate, y_true=y, y_pred=y, sensitive_features=s)
    selection_rates = mf.by_group.to_dict()

    # choose privileged group: explicit or majority group by count
    if privileged_value is None:
        privileged_value = s.value_counts().idxmax()

    if privileged_value not in selection_rates:
        raise ValueError(f"privileged_value '{privileged_value}' not present in sensitive groups")

    priv_rate = float(selection_rates[privileged_value])

    results: Dict[str, Any] = {
        "privileged_group": privileged_value,
        "selection_rates": {str(k): float(v) for k, v in selection_rates.items()},
        "metrics": {},
    }

    for group, rate in selection_rates.items():
        if group == privileged_value:
            continue
        unpriv_rate = float(rate)
        # Statistical Parity Difference = P(Yhat=1|D=unpriv) - P(Yhat=1|D=priv)
        spd = unpriv_rate - priv_rate
        # Disparate Impact = P(Yhat=1|D=unpriv) / P(Yhat=1|D=priv)
        di = None
        if priv_rate == 0:
            di = None
        else:
            di = unpriv_rate / priv_rate

        results["metrics"][str(group)] = {
            "disparate_impact": di,
            "statistical_parity_difference": spd,
        }

    return results


def simulate_reweighting_improvements(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build hypothetical (not trained) fairness improvements for a re-weighting simulation.
    """
    improved = {
        "privileged_group": metrics["privileged_group"],
        "selection_rates": dict(metrics["selection_rates"]),
        "metrics": {},
    }

    metric_items = sorted(metrics.get("metrics", {}).items(), key=lambda x: x[0])
    for idx, (group, values) in enumerate(metric_items):
        # Deterministic factor in [0.20, 0.30] for stable UI previews.
        improvement_factor = 0.20 + ((idx % 3) * 0.05)
        di = values.get("disparate_impact")
        spd = values.get("statistical_parity_difference")

        improved_di = None
        if di is not None:
            improved_di = float(di) + ((1.0 - float(di)) * improvement_factor)

        improved_spd = None
        if spd is not None:
            improved_spd = float(spd) * (1.0 - improvement_factor)

        improved["metrics"][group] = {
            "disparate_impact": improved_di,
            "statistical_parity_difference": improved_spd,
            "improvement_factor": round(improvement_factor, 2),
        }

    return improved


def format_audit_report_markdown(
    title: str,
    narrative: str,
    charts: Dict[str, Any],
    executive_summary: str = "",
) -> str:
    chart_json = json.dumps(charts or {}, indent=2)

    sections = [
        f"# {title}",
        "",
        "## Executive Summary",
        executive_summary or "_Not provided_",
        "",
        "## AI Narrative",
        narrative or "_Not provided_",
        "",
        "## Chart Data Snapshot",
        "```json",
        chart_json,
        "```",
        "",
        "## Notes",
        "- Generated by Neural Stack audit pipeline.",
        "- This report includes chart data payload for reproducibility.",
    ]
    return "\n".join(sections)


def extract_red_flags(summary: str) -> list[str]:
    lines = [line.strip() for line in summary.splitlines() if line.strip()]
    bullet_lines = []
    for line in lines:
        normalized = re.sub(r"^\s*[-*]\s*", "", line)
        if normalized.lower().startswith(("risk", "warning", "red flag", "concern")):
            bullet_lines.append(normalized)
        elif any(term in normalized.lower() for term in ("high", "severe", "bias", "disparity")):
            bullet_lines.append(normalized)
        if len(bullet_lines) >= 5:
            break

    if bullet_lines:
        return bullet_lines

    return ["No explicit red flags extracted from LLM response."]


@app.post("/analyze")
async def analyze(data: dict):
    """Analyze stored dataframe for fairness metrics.

    Expected JSON body: {"data_id": "<id>", "target_column": "yhat", "sensitive_column": "gender", "privileged_value": "male" (optional)}
    """
    data_id = data.get("data_id")
    target_column = data.get("target_column")
    sensitive_column = data.get("sensitive_column")
    privileged_value = data.get("privileged_value")

    if not data_id:
        raise HTTPException(status_code=400, detail="data_id is required")
    if not target_column:
        raise HTTPException(status_code=400, detail="target_column is required")
    if not sensitive_column:
        raise HTTPException(status_code=400, detail="sensitive_column is required")

    if data_id not in DATAFRAMES:
        raise HTTPException(status_code=404, detail="data_id not found")

    df = DATAFRAMES[data_id]

    try:
        metrics = compute_fairness_metrics(df, target_column, sensitive_column, privileged_value)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    return {"data_id": data_id, "analysis": metrics}


@app.post("/narrative")
async def generate_narrative(data: dict):
    """Generate bias audit narrative from fairness metrics using GPT-4o.

    Expected JSON body: {
        "data_id": "<id>",
        "target_column": "yhat",
        "sensitive_column": "gender",
        "privileged_value": "male" (optional)
    }
    """
    data_id = data.get("data_id")
    target_column = data.get("target_column")
    sensitive_column = data.get("sensitive_column")
    privileged_value = data.get("privileged_value")

    if not data_id:
        raise HTTPException(status_code=400, detail="data_id is required")
    if not target_column:
        raise HTTPException(status_code=400, detail="target_column is required")
    if not sensitive_column:
        raise HTTPException(status_code=400, detail="sensitive_column is required")

    if data_id not in DATAFRAMES:
        raise HTTPException(status_code=404, detail="data_id not found")

    df = DATAFRAMES[data_id]

    try:
        # Compute fairness metrics first
        metrics = compute_fairness_metrics(df, target_column, sensitive_column, privileged_value)

        # Generate narrative using LangChain + GPT-4o
        available_columns = list(df.columns)
        narrative = generate_bias_narrative(
            metrics,
            available_columns,
            sensitive_column,
        )

        return {
            "data_id": data_id,
            "sensitive_attribute": sensitive_column,
            "metrics": metrics,
            "narrative": narrative,
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating narrative: {str(e)}")


class AgentReasoningResponse(BaseModel):
    summary: str
    red_flags: List[str]
    status: str

@app.post("/agent-reasoning", response_model=AgentReasoningResponse)
async def agent_reasoning(data: dict):
    """
    Simulate an agentic reasoning workflow for terminal-style UI.

    Expected JSON body: {"data_id": "<id>", "sensitive_attribute": "gender" (optional)}
    """
    data_id = data.get("data_id")
    sensitive_attribute = data.get("sensitive_attribute")
    if not data_id:
        raise HTTPException(status_code=400, detail="data_id is required")

    if data_id not in DATAFRAMES:
        raise HTTPException(status_code=404, detail="data_id not found")

    df = DATAFRAMES[data_id]
    row_count = int(len(df))
    column_count = int(len(df.columns))
    numeric_cols = list(df.select_dtypes(include="number").columns)
    categorical_cols = list(df.select_dtypes(exclude="number").columns)

    null_counts = {col: int(count) for col, count in df.isnull().sum().to_dict().items()}
    top_numeric_correlations = []
    if len(numeric_cols) >= 2:
        corr_matrix = df[numeric_cols].corr(numeric_only=True)
        corr_pairs = []
        for i, col_a in enumerate(numeric_cols):
            for col_b in numeric_cols[i + 1:]:
                corr_value = corr_matrix.loc[col_a, col_b]
                if pd.notna(corr_value):
                    corr_pairs.append(
                        {
                            "feature_a": col_a,
                            "feature_b": col_b,
                            "correlation": float(corr_value),
                        }
                    )
        top_numeric_correlations = sorted(
            corr_pairs, key=lambda x: abs(x["correlation"]), reverse=True
        )[:5]

    dataset_stats: Dict[str, Any] = {
        "row_count": row_count,
        "column_count": column_count,
        "columns": list(df.columns),
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "null_counts": null_counts,
        "top_numeric_correlations": top_numeric_correlations,
    }

    if sensitive_attribute:
        dataset_stats["sensitive_attribute"] = sensitive_attribute

    try:
        summary = analyze_hidden_correlations(dataset_stats)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating agent reasoning: {str(e)}")

    red_flags = extract_red_flags(summary)

    return {
        "summary": summary,
        "red_flags": red_flags,
        "status": "complete",
    }


@app.post("/simulate-mitigation")
async def simulate_mitigation(data: dict):
    """
    Simulate a re-weighting mitigation strategy without retraining a model.

    Expected JSON body: {
        "data_id": "<id>",
        "target_column": "yhat",
        "sensitive_column": "gender",
        "privileged_value": "male" (optional)
    }
    """
    data_id = data.get("data_id")
    target_column = data.get("target_column")
    sensitive_column = data.get("sensitive_column")
    privileged_value = data.get("privileged_value")

    if not data_id:
        raise HTTPException(status_code=400, detail="data_id is required")
    if not target_column:
        raise HTTPException(status_code=400, detail="target_column is required")
    if not sensitive_column:
        raise HTTPException(status_code=400, detail="sensitive_column is required")

    if data_id not in DATAFRAMES:
        raise HTTPException(status_code=404, detail="data_id not found")

    df = DATAFRAMES[data_id]
    try:
        before_metrics = compute_fairness_metrics(df, target_column, sensitive_column, privileged_value)
        after_metrics = simulate_reweighting_improvements(before_metrics)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    return {
        "data_id": data_id,
        "mitigation_strategy": "Re-weighting (simulated)",
        "is_hypothetical": True,
        "improvement_range": "20-30%",
        "before_metrics": before_metrics,
        "after_metrics": after_metrics,
    }


@app.post("/report")
async def generate_report(data: dict):
    """
    Generate a formatted markdown audit report from narrative + chart payloads.

    Expected JSON body:
    {
        "title": "Neural Stack Bias Audit Report" (optional),
        "narrative": "...",
        "executive_summary": "..." (optional),
        "charts": {...}
    }
    """
    narrative = data.get("narrative")
    charts = data.get("charts")
    title = data.get("title", "Neural Stack Bias Audit Report")
    executive_summary = data.get("executive_summary", "")

    if not narrative:
        raise HTTPException(status_code=400, detail="narrative is required")
    if charts is None:
        raise HTTPException(status_code=400, detail="charts is required")
    if not isinstance(charts, dict):
        raise HTTPException(status_code=400, detail="charts must be a JSON object")

    markdown = format_audit_report_markdown(
        title=title,
        narrative=narrative,
        charts=charts,
        executive_summary=executive_summary,
    )

    return {"report_markdown": markdown}



if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
