"""Bias analysis helpers for dataset fairness audits."""

from __future__ import annotations

from typing import Any, Dict

import pandas as pd


POSITIVE_OUTCOME_VALUES = {"1", "1.0", "true", "yes", "y", "positive", "pos"}


def _normalize_sensitive_values(series: pd.Series) -> pd.Series:
    return series.fillna("__missing__").astype(str)


def _positive_selection_mask(series: pd.Series) -> tuple[pd.Series, pd.Series]:
    valid_mask = series.notna()
    positive_mask = pd.Series(False, index=series.index)

    if valid_mask.any():
        normalized = series.loc[valid_mask].astype(str).str.strip().str.lower()
        positive_mask.loc[valid_mask] = normalized.isin(POSITIVE_OUTCOME_VALUES).to_numpy()

    return valid_mask, positive_mask


def analyze_dataset_comprehensive(
    df: pd.DataFrame,
    sensitive_column: str,
    outcome_column: str,
    privileged_value: Any | None = None,
) -> Dict[str, Any]:
    if df.empty:
        raise ValueError("The uploaded dataset is empty")
    if sensitive_column not in df.columns:
        raise ValueError(f"sensitive_column '{sensitive_column}' not found in dataframe")
    if outcome_column not in df.columns:
        raise ValueError(f"outcome_column '{outcome_column}' not found in dataframe")

    sensitive_series = _normalize_sensitive_values(df[sensitive_column])
    valid_outcome_mask, positive_mask = _positive_selection_mask(df[outcome_column])

    group_distribution = {
        str(group): int(count)
        for group, count in sensitive_series.value_counts(dropna=False).items()
    }

    risk_rates: Dict[str, float] = {}
    for group in sorted(group_distribution.keys()):
        group_mask = sensitive_series == group
        analysis_mask = group_mask & valid_outcome_mask
        if int(analysis_mask.sum()) == 0:
            risk_rates[group] = 0.0
        else:
            risk_rates[group] = float(positive_mask.loc[analysis_mask].mean())

    if privileged_value is None:
        reference_group = max(group_distribution, key=group_distribution.get)
    else:
        reference_group = str(privileged_value)

    if reference_group not in risk_rates:
        raise ValueError(f"privileged_value '{reference_group}' not present in sensitive groups")

    reference_rate = float(risk_rates[reference_group])
    comparison_group, comparison_rate = min(risk_rates.items(), key=lambda item: item[1])
    comparison_rate = float(comparison_rate)

    statistical_parity_difference = comparison_rate - reference_rate
    disparate_impact_ratio = None
    if reference_rate > 0:
        disparate_impact_ratio = comparison_rate / reference_rate

    if disparate_impact_ratio is None:
        verdict = "High Bias"
    elif disparate_impact_ratio >= 0.8:
        verdict = "Fair"
    elif disparate_impact_ratio >= 0.5:
        verdict = "Caution"
    else:
        verdict = "High Bias"

    return {
        "overview": {
            "total_rows": int(len(df)),
            "missing_values": int(df.isna().sum().sum()),
            "columns": list(df.columns),
        },
        "group_distribution": group_distribution,
        "metrics": {
            "statistical_parity_difference": float(statistical_parity_difference),
            "disparate_impact_ratio": disparate_impact_ratio,
            "reference_group": reference_group,
            "comparison_group": comparison_group,
        },
        "risk_rates": risk_rates,
        "verdict": verdict,
    }


def compute_fairness_metrics(
    df: pd.DataFrame,
    target_column: str,
    sensitive_column: str,
    privileged_value: Any | None = None,
) -> Dict[str, Any]:
    comprehensive = analyze_dataset_comprehensive(
        df=df,
        sensitive_column=sensitive_column,
        outcome_column=target_column,
        privileged_value=privileged_value,
    )

    selection_rates = comprehensive["risk_rates"]
    if privileged_value is None:
        privileged_value = max(comprehensive["group_distribution"], key=comprehensive["group_distribution"].get)
    else:
        privileged_value = str(privileged_value)

    if privileged_value not in selection_rates:
        raise ValueError(f"privileged_value '{privileged_value}' not present in sensitive groups")

    priv_rate = float(selection_rates[privileged_value])
    results: Dict[str, Any] = {
        "privileged_group": privileged_value,
        "selection_rates": {str(group): float(rate) for group, rate in selection_rates.items()},
        "metrics": {},
    }

    for group, rate in selection_rates.items():
        if group == privileged_value:
            continue
        unpriv_rate = float(rate)
        spd = unpriv_rate - priv_rate
        di = None if priv_rate == 0 else unpriv_rate / priv_rate
        results["metrics"][str(group)] = {
            "disparate_impact": di,
            "statistical_parity_difference": spd,
        }

    return results