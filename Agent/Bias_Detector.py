import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
import warnings
warnings.filterwarnings("ignore")

# Try to import Fairlearn (recommended for production/hackathon)
try:
    from fairlearn.metrics import (
        MetricFrame,
        demographic_parity_difference,
        demographic_parity_ratio,
        equal_opportunity_difference,
        equalized_odds_difference,
        false_positive_rate,
        true_positive_rate,
        selection_rate,
    )
    FAIRLEARN_AVAILABLE = True
except ImportError:
    FAIRLEARN_AVAILABLE = False
    print("Warning: Fairlearn not installed. Falling back to basic metrics. Install with: pip install fairlearn")

def preprocess_sensitive_columns(df: pd.DataFrame, sensitive_cols: List[str], age_bins: bool = True) -> pd.DataFrame:
    """Preprocessing helpers: auto-bin age, handle missing values, flag issues."""
    df = df.copy()
    issues = []

    for col in sensitive_cols:
        if col not in df.columns:
            continue

        # Handle missing values
        missing_pct = df[col].isna().mean() * 100
        if missing_pct > 5:
            issues.append(f"High missing values in '{col}' ({missing_pct:.1f}%) — consider imputation or removal.")
            df[col] = df[col].fillna("Unknown")

        # Auto-bin continuous columns like age
        if age_bins and pd.api.types.is_numeric_dtype(df[col]) and df[col].nunique() > 10:
            if col.lower().startswith("age"):
                bins = [0, 18, 25, 35, 45, 55, 65, 100]
                labels = ["<18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
                df[col] = pd.cut(df[col], bins=bins, labels=labels, include_lowest=True)
                issues.append(f"Auto-binned '{col}' into categorical groups.")

        # Flag high-cardinality (risk of overfitting or privacy issues)
        if df[col].nunique() > 20 and not pd.api.types.is_numeric_dtype(df[col]):
            issues.append(f"High cardinality in '{col}' ({df[col].nunique()} unique values) — may act as proxy or cause fragmentation.")

    return df, issues


def detect_proxy_features(df: pd.DataFrame, sensitive_cols: List[str], other_cols: Optional[List[str]] = None, threshold: float = 0.6) -> List[Dict]:
    """Detect potential proxy features using correlation / association."""
    proxies = []
    numeric_df = df.select_dtypes(include=[np.number])
    
    if other_cols is None:
        other_cols = [c for c in numeric_df.columns if c not in sensitive_cols]
    
    for sens in sensitive_cols:
        if sens not in numeric_df.columns:
            continue  # Skip non-numeric sensitive for simple correlation (can extend with mutual_info later)
        
        for feat in other_cols:
            if feat == sens or feat not in numeric_df.columns:
                continue
            corr = abs(numeric_df[sens].corr(numeric_df[feat]))
            if corr > threshold:
                proxies.append({
                    "sensitive": sens,
                    "proxy_candidate": feat,
                    "correlation": round(float(corr), 3),
                    "risk": "High" if corr > 0.75 else "Medium"
                })
    
    return proxies


def analyze_bias(
    df: pd.DataFrame,
    target_col: str,
    sensitive_cols: List[str],
    prediction_col: Optional[str] = None,      # For model predictions fairness
    positive_label: Any = 1,
    task_type: str = "classification",         # classification or regression
    age_binning: bool = True
) -> Dict:
    """
    Professional bias analysis using Fairlearn where possible + fallback.
    Supports data bias (target) and model bias (predictions).
    """
    df, preprocessing_issues = preprocess_sensitive_columns(df, sensitive_cols, age_binning)
    
    results: Dict = {
        "attributes": {},
        "overall_bias_score": 0.0,
        "overall_level": "fair",
        "preprocessing_issues": preprocessing_issues,
        "proxy_features": detect_proxy_features(df, sensitive_cols),
        "target_column": target_col,
        "prediction_column": prediction_col,
        "task_type": task_type,
        "total_rows": len(df),
        "metrics_used": []
    }

    valid_sensitive = [col for col in sensitive_cols if col in df.columns]
    bias_scores = []

    for col in valid_sensitive:
        col_result: Dict = {
            "attribute": col,
            "bias_score": 0.0,
            "level": "fair",
            "metrics": {},
            "distribution": {},
            "group_sizes": {},
            "notes": [],
            "fairlearn_metrics": {}
        }

        # Basic distribution
        value_counts = df[col].value_counts(normalize=True).round(4)
        counts = df[col].value_counts()
        col_result["distribution"] = {str(k): float(v) for k, v in value_counts.items()}
        col_result["group_sizes"] = {str(k): int(v) for k, v in counts.items()}

        if (counts < 30).any():
            col_result["notes"].append("Some groups have <30 samples — metrics may be unstable.")

        # Determine what to analyze: true target or model predictions
        outcome_col = prediction_col if prediction_col and prediction_col in df.columns else target_col

        if outcome_col in df.columns:
            # Prepare y_true and y_pred for Fairlearn (if applicable)
            y_true = None
            y_pred = None
            
            if prediction_col and prediction_col in df.columns:
                y_true = (df[target_col] == positive_label).astype(int) if task_type == "classification" else df[target_col]
                y_pred = (df[prediction_col] == positive_label).astype(int) if task_type == "classification" else df[prediction_col]
                metric_name = "Model Predictions"
            else:
                y_true = df[target_col]
                y_pred = None
                metric_name = "Data Outcome Rates"

            # Use Fairlearn MetricFrame when possible
            if FAIRLEARN_AVAILABLE and task_type == "classification":
                try:
                    mf = MetricFrame(
                        metrics={
                            "selection_rate": selection_rate,
                            "true_positive_rate": true_positive_rate,
                            "false_positive_rate": false_positive_rate,
                        },
                        y_true=y_true if y_pred is not None else None,
                        y_pred=y_pred if y_pred is not None else (df[outcome_col] == positive_label).astype(int),
                        sensitive_features=df[col]
                    )
                    
                    col_result["fairlearn_metrics"] = {
                        "demographic_parity_difference": float(demographic_parity_difference(y_true=y_pred if y_pred is not None else y_true, sensitive_features=df[col])),
                        "demographic_parity_ratio": float(demographic_parity_ratio(y_true=y_pred if y_pred is not None else y_true, sensitive_features=df[col])),
                        "equal_opportunity_difference": float(equal_opportunity_difference(y_true=y_true, y_pred=y_pred if y_pred is not None else (df[outcome_col] == positive_label).astype(int), sensitive_features=df[col])),
                        "equalized_odds_difference": float(equalized_odds_difference(y_true=y_true, y_pred=y_pred if y_pred is not None else (df[outcome_col] == positive_label).astype(int), sensitive_features=df[col])) if y_pred is not None else None,
                    }
                    
                    results["metrics_used"].append("Fairlearn (demographic parity, equal opportunity, equalized odds)")
                    
                    # Derive overall bias score from key metrics (0-100 scale)
                    dpd = abs(col_result["fairlearn_metrics"]["demographic_parity_difference"])
                    eod = abs(col_result["fairlearn_metrics"].get("equal_opportunity_difference", 0))
                    bias_score = round(max(dpd, eod) * 100, 2)
                    
                except Exception as e:
                    # Fallback to manual calculation
                    bias_score = _fallback_bias_calculation(df, col, outcome_col, positive_label)
            else:
                bias_score = _fallback_bias_calculation(df, col, outcome_col, positive_label)

            col_result["bias_score"] = bias_score
            bias_scores.append(bias_score)

            # Level classification (aligned with common standards like 80% rule)
            if bias_score < 15:
                col_result["level"] = "fair"
            elif bias_score < 40:
                col_result["level"] = "moderate"
            else:
                col_result["level"] = "biased"

        results["attributes"][col] = col_result

    # Overall score
    if bias_scores:
        results["overall_bias_score"] = round(float(np.mean(bias_scores)), 2)
        if results["overall_bias_score"] < 15:
            results["overall_level"] = "fair"
        elif results["overall_bias_score"] < 40:
            results["overall_level"] = "moderate"
        else:
            results["overall_level"] = "biased"

    return results


def _fallback_bias_calculation(df: pd.DataFrame, sensitive_col: str, outcome_col: str, positive_label: Any) -> float:
    """Simple fallback when Fairlearn is unavailable or for regression."""
    group_rates = df.groupby(sensitive_col)[outcome_col].apply(
        lambda x: (x == positive_label).mean() if len(x) > 0 else 0
    )
    if len(group_rates) < 2:
        return 0.0
    max_r = group_rates.max()
    min_r = group_rates.min()
    disparate_impact = min_r / max_r if max_r > 0 else 1.0
    return round(max(0, (1 - disparate_impact) * 100), 2)


def suggest_fixes(bias_results: Dict, df: Optional[pd.DataFrame] = None) -> List[Dict]:
    """Rich, actionable suggestions with example mitigation code snippets (before/after friendly)."""
    suggestions = []
    attributes = bias_results.get("attributes", {})

    for attr, data in attributes.items():
        score = data.get("bias_score", 0)
        level = data.get("level", "fair")
        
        if level == "biased" or score > 30:
            fix = {
                "attribute": attr,
                "severity": "High",
                "description": f"Strong bias detected in '{attr}' (score: {score}).",
                "actions": [
                    "Re-sample or re-weight the dataset to balance groups.",
                    "Remove or transform the feature if it (or its proxies) correlates with protected attributes.",
                    "Use in-processing mitigation (e.g., Fairlearn ExponentiatedGradient).",
                ],
                "example_code": f"""# Example mitigation using Fairlearn
from fairlearn.reductions import ExponentiatedGradient
from sklearn.linear_model import LogisticRegression

constraint = DemographicParity()  # or EqualizedOdds()
mitigator = ExponentiatedGradient(LogisticRegression(), constraint)
mitigator.fit(X_train, y_train, sensitive_features=train_df['{attr}'])
"""
            }
            suggestions.append(fix)

        elif level == "moderate":
            suggestions.append({
                "attribute": attr,
                "severity": "Medium",
                "description": f"Moderate bias in '{attr}' — worth reviewing.",
                "actions": ["Monitor + light re-weighting", "Check for proxy features"],
                "example_code": "# Simple reweighting example: use sample weights inversely proportional to group size"
            })

    # General recommendations
    if bias_results.get("proxy_features"):
        suggestions.append({
            "type": "proxy_warning",
            "description": "Potential proxy features detected — review correlations.",
            "proxies": bias_results["proxy_features"]
        })

    if not suggestions:
        suggestions.append({"description": "Dataset appears relatively fair. Continue with regular audits and intersectional analysis."})

    return suggestions