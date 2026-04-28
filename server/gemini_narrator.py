"""Gemini-powered audit report generation for fairness metrics."""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Set, Tuple

try:
    import google.generativeai as genai
except ImportError:
    genai = None


def _normalize_model_name(model_name: str) -> str:
    return model_name.replace("models/", "", 1)


def _get_generate_content_models(preferred_model: str) -> Tuple[List[str], Set[str]]:
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
            # Exclude TTS and audio-only models
            if "tts" in normalized_name.lower() or "audio" in normalized_name.lower():
                continue
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


def _extract_json_object(text: str) -> Dict[str, Any]:
    cleaned = text.strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        parsed = json.loads(match.group(0))
        if isinstance(parsed, dict):
            return parsed

    raise ValueError("Gemini did not return valid JSON")


def generate_audit_report(metrics_json: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a structured audit report from fairness metrics using Gemini.

    Returns a dictionary with keys:
    - explanation
    - hidden_correlations
    - recommendations
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
        raise ValueError("No Gemini models with generateContent support are available for this API key/project.")

    prompt = f"""You are a senior fairness auditor.

Use the dataset metrics below to produce a JSON object only.

Rules:
- Return valid JSON only, with no markdown fences and no extra commentary.
- Use exactly these top-level keys: explanation, hidden_correlations, recommendations.
- explanation must be exactly 3 sentences written for a non-technical manager.
- hidden_correlations must explain whether other columns appear to act as proxies for the sensitive attribute.
- recommendations must be a bulleted list of technical mitigation suggestions.

Metrics:
{json.dumps(metrics_json, indent=2)}

JSON shape:
{{
  "explanation": "...",
  "hidden_correlations": "...",
  "recommendations": ["...", "..."]
}}"""

    quota_retries: List[int] = []
    last_error_message = ""

    for selected_model in candidate_models:
        model = genai.GenerativeModel(selected_model)
        try:
            response = model.generate_content(prompt)
            if not response or not response.text:
                raise ValueError("Empty response from Gemini")

            report = _extract_json_object(response.text)
            explanation = str(report.get("explanation", "")).strip()
            hidden_correlations = str(report.get("hidden_correlations", "")).strip()
            recommendations = report.get("recommendations", [])

            if isinstance(recommendations, str):
                recommendations = [recommendations]
            elif not isinstance(recommendations, list):
                recommendations = []

            return {
                "explanation": explanation,
                "hidden_correlations": hidden_correlations,
                "recommendations": [str(item).strip() for item in recommendations if str(item).strip()],
            }
        except Exception as exc:
            error_message = str(exc)
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
            f"Gemini free-tier quota/rate limit reached across available models. Retry in about {min_retry} seconds."
        )

    raise ValueError(last_error_message or "Gemini API error: request failed for all available models.")