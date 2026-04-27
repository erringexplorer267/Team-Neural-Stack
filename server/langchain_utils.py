"""Bias audit narrative generation using Google Generative AI."""

import os
import json
import re
from typing import Dict, Any, List, Set, Tuple

try:
    import google.generativeai as genai
except ImportError:
    genai = None


def _normalize_model_name(model_name: str) -> str:
    return model_name.replace("models/", "", 1)


def _get_generate_content_models(preferred_model: str) -> Tuple[List[str], Set[str]]:
    """
    Return ordered generateContent-capable models from the current API key's accessible models.
    """
    preferred_candidates = [
        preferred_model,
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
    ]

    available_models = genai.list_models()
    generate_content_models: Set[str] = set()

    for model in available_models:
        supported_methods = set(getattr(model, "supported_generation_methods", []) or [])
        if "generateContent" not in supported_methods:
            continue
        model_name = getattr(model, "name", "")
        if model_name:
            normalized_name = _normalize_model_name(model_name)
            if normalized_name.startswith("gemini"):
                generate_content_models.add(normalized_name)

    ordered_models: List[str] = []
    seen: Set[str] = set()

    for candidate in preferred_candidates:
        normalized = _normalize_model_name(candidate)
        if normalized in generate_content_models and normalized not in seen:
            ordered_models.append(normalized)
            seen.add(normalized)

    for model_name in sorted(generate_content_models):
        if model_name not in seen:
            ordered_models.append(model_name)
            seen.add(model_name)

    return ordered_models, generate_content_models


def _is_quota_error(error_message: str) -> bool:
    lower_msg = error_message.lower()
    return (
        "quota" in lower_msg
        or "rate limit" in lower_msg
        or "resourceexhausted" in lower_msg
        or "429" in lower_msg
    )


def _extract_retry_seconds(error_message: str) -> int | None:
    float_match = re.search(r"retry in ([0-9]+(?:\.[0-9]+)?)s", error_message, re.IGNORECASE)
    if float_match:
        return max(1, int(float(float_match.group(1))))

    int_match = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", error_message, re.IGNORECASE)
    if int_match:
        return max(1, int(int_match.group(1)))

    return None


def generate_bias_narrative(
    stats_json: Dict[str, Any],
    available_columns: List[str],
    sensitive_attribute: str,
) -> str:
    """
    Generate a bias audit narrative from fairness metrics using Google Gemini.

    Args:
        stats_json: Fairness metrics from compute_fairness_metrics()
        available_columns: List of column names available in the dataset
        sensitive_attribute: Name of the sensitive attribute being analyzed

    Returns:
        Narrative explanation of bias findings with disparate impact explanation and proxy variables.
    """
    if genai is None:
        raise ImportError("google-generativeai package is required. Run: pip install google-generativeai")
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY not set. Please set it in server/.env file"
        )

    # Configure Google Generative AI
    genai.configure(api_key=api_key)
    # Prefer user override, but auto-select/fallback from accessible models if needed.
    preferred_model_env = os.getenv("GEMINI_MODEL")
    model_name = preferred_model_env or "gemini-2.0-flash"
    normalized_preferred = _normalize_model_name(model_name)
    if preferred_model_env and not normalized_preferred.startswith("gemini"):
        raise ValueError(
            f"Invalid GEMINI_MODEL '{normalized_preferred}'. "
            "Use a Gemini model name such as 'gemini-2.0-flash', or unset GEMINI_MODEL for auto-selection."
        )

    candidate_models, available_models = _get_generate_content_models(model_name)
    if preferred_model_env and normalized_preferred not in available_models:
        raise ValueError(
            f"Configured GEMINI_MODEL '{normalized_preferred}' is not available for this API key/project. "
            "Unset GEMINI_MODEL to auto-select an available Gemini model."
        )
    if not candidate_models:
        raise ValueError(
            "No Gemini models with generateContent support are available for this API key/project."
        )

    # Format metrics for the prompt
    metrics_str = json.dumps(stats_json, indent=2)
    columns_str = ", ".join(available_columns)

    # Create the prompt
    prompt = f"""You are a Senior Bias Auditor with expertise in fairness in machine learning.

Analyze these fairness metrics and provide a bias audit report.

**Fairness Metrics:**
{metrics_str}

**Sensitive Attribute:** {sensitive_attribute}

**Dataset Columns:** {columns_str}

Provide analysis in this format:

1. **Disparate Impact Explanation (2 sentences):** Explain the Disparate Impact Ratio in plain English. Reference actual values.

2. **Findings Summary:** Summarize fairness findings in layman's terms.

3. **Potential Proxy Variables:** Identify columns that could be proxies for "{sensitive_attribute}" (e.g., zip code for race, age for other demographics). 

4. **Risk Assessment:** Rate severity as Low, Medium, or High with explanation.

5. **Recommendations:** Suggest 2-3 concrete mitigation steps."""

    quota_retries: List[int] = []
    last_error_message = ""

    for selected_model in candidate_models:
        model = genai.GenerativeModel(selected_model)
        try:
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text
            raise ValueError("Empty response from Gemini")
        except Exception as e:
            error_message = str(e)
            last_error_message = f"Gemini API error ({selected_model}): {error_message}"
            if _is_quota_error(error_message):
                retry_seconds = _extract_retry_seconds(error_message)
                if retry_seconds is not None:
                    quota_retries.append(retry_seconds)
                continue
            raise ValueError(last_error_message)

    if quota_retries:
        min_retry = min(quota_retries)
        raise ValueError(
            f"Gemini free-tier quota/rate limit reached across available models. "
            f"Retry in about {min_retry} seconds."
        )

    raise ValueError(last_error_message or "Gemini API error: request failed for all available models.")


def generate_gemini_text(prompt: str) -> str:
    """
    Generate text from Gemini with shared model selection and quota handling.
    """
    if genai is None:
        raise ImportError("google-generativeai package is required. Run: pip install google-generativeai")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set. Please set it in server/.env file")

    genai.configure(api_key=api_key)

    preferred_model_env = os.getenv("GEMINI_MODEL")
    model_name = preferred_model_env or "gemini-2.0-flash"
    normalized_preferred = _normalize_model_name(model_name)
    if preferred_model_env and not normalized_preferred.startswith("gemini"):
        raise ValueError(
            f"Invalid GEMINI_MODEL '{normalized_preferred}'. "
            "Use a Gemini model name such as 'gemini-2.0-flash', or unset GEMINI_MODEL for auto-selection."
        )

    candidate_models, available_models = _get_generate_content_models(model_name)
    if preferred_model_env and normalized_preferred not in available_models:
        raise ValueError(
            f"Configured GEMINI_MODEL '{normalized_preferred}' is not available for this API key/project. "
            "Unset GEMINI_MODEL to auto-select an available Gemini model."
        )
    if not candidate_models:
        raise ValueError(
            "No Gemini models with generateContent support are available for this API key/project."
        )

    quota_retries: List[int] = []
    last_error_message = ""

    for selected_model in candidate_models:
        model = genai.GenerativeModel(selected_model)
        try:
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text
            raise ValueError("Empty response from Gemini")
        except Exception as e:
            error_message = str(e)
            last_error_message = f"Gemini API error ({selected_model}): {error_message}"
            if _is_quota_error(error_message):
                retry_seconds = _extract_retry_seconds(error_message)
                if retry_seconds is not None:
                    quota_retries.append(retry_seconds)
                continue
            raise ValueError(last_error_message)

    if quota_retries:
        min_retry = min(quota_retries)
        raise ValueError(
            f"Gemini free-tier quota/rate limit reached across available models. "
            f"Retry in about {min_retry} seconds."
        )

    raise ValueError(last_error_message or "Gemini API error: request failed for all available models.")


def analyze_hidden_correlations(data_stats: Dict[str, Any]) -> str:
    """
    Ask Gemini to identify hidden correlations and key risks from dataset stats.
    """
    stats_str = json.dumps(data_stats, indent=2)
    prompt = f"""You are an AI audit analyst.

Given these dataset statistics, identify hidden correlations, suspicious relationships,
and potential bias risks in a concise executive summary for a product manager.

Dataset statistics:
{stats_str}

Return 4 short sections:
1. Hidden correlations
2. Potential proxy variables
3. Risk level (Low/Medium/High) with one-line rationale
4. Recommended next checks (2 bullets)
"""
    return generate_gemini_text(prompt)


def batch_generate_narratives(
    stats_json_list: List[Dict[str, Any]],
    available_columns: List[str],
    sensitive_attributes: List[str],
) -> Dict[str, str]:
    """
    Generate bias narratives for multiple sensitive attributes.

    Args:
        stats_json_list: List of fairness metric dicts
        available_columns: Dataset columns
        sensitive_attributes: List of sensitive attribute names

    Returns:
        Dictionary mapping sensitive_attribute -> narrative
    """
    if len(stats_json_list) != len(sensitive_attributes):
        raise ValueError(
            "Length of stats_json_list and sensitive_attributes must match"
        )

    narratives = {}
    for stats, attr in zip(stats_json_list, sensitive_attributes):
        try:
            narrative = generate_bias_narrative(stats, available_columns, attr)
            narratives[attr] = narrative
        except Exception as e:
            narratives[attr] = f"Error generating narrative: {str(e)}"

    return narratives
