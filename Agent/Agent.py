import json
import pandas as pd
from typing import Dict, Any, Optional

from langchain_anthropic import ChatAnthropic
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

# Initialize Claude (use Sonnet for best reasoning)
llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",   # or claude-3-5-sonnet-20240620
    temperature=0.2,
    max_tokens=2000,
)

# ==================== TOOLS FOR THE AGENT ====================

@tool
def get_detailed_group_stats(sensitive_col: str, target_col: str) -> str:
    """Get detailed statistics and distribution for a specific sensitive attribute vs target."""
    # In real implementation, you'll inject df or use a shared state
    df = ...  # Access your DataFrame here (via closure, class, or state)
    if sensitive_col not in df.columns or target_col not in df.columns:
        return "Column not found."
    
    group_stats = df.groupby(sensitive_col)[target_col].agg(['mean', 'count', 'std']).round(4)
    positive_rate = df.groupby(sensitive_col)[target_col].apply(
        lambda x: (x == 1).mean() if x.nunique() <= 2 else x.mean()
    )
    
    return f"""Group Statistics for '{sensitive_col}':
{group_stats.to_string()}

Positive Outcome Rates:
{positive_rate.to_string()}
"""

@tool
def get_proxy_features() -> str:
    """Return detected proxy features that may be causing indirect bias."""
    # This will be populated from analyze_bias() results
    proxies = ...  # Inject from bias_results
    if not proxies:
        return "No significant proxy features detected."
    return json.dumps(proxies, indent=2)

@tool
def suggest_mitigation_code(attr: str, severity: str) -> str:
    """Generate concrete code example for mitigating bias in a specific attribute."""
    return f"""# Mitigation example for '{attr}' ({severity} bias)

from fairlearn.reductions import ExponentiatedGradient, DemographicParity
from sklearn.linear_model import LogisticRegression

# Option 1: In-processing mitigation
mitigator = ExponentiatedGradient(
    LogisticRegression(max_iter=1000), 
    constraints=DemographicParity()
)
mitigator.fit(X_train, y_train, sensitive_features=train_df['{attr}'])

# Option 2: Reweighting (simple)
group_sizes = train_df['{attr}'].value_counts()
sample_weights = train_df['{attr}'].map(lambda x: 1 / group_sizes[x])
"""

# List of tools the agent can use autonomously
tools = [get_detailed_group_stats, get_proxy_features, suggest_mitigation_code]

# Create the ReAct Agent
agent = create_react_agent(
    model=llm,
    tools=tools,
)

async def run_agent(
    bias_results: Dict,
    df: Optional[pd.DataFrame] = None,           # Full dataframe for tools
    csv_preview: Optional[str] = None
) -> str:
    """
    Upgraded Autonomous FairLens Agent
    Now truly tool-using and deeply integrated with analyze_bias() output.
    """
    
    # Prepare rich context from the new analyze_bias output
    bias_summary = json.dumps(bias_results, indent=2, default=str)
    
    if csv_preview is None and df is not None:
        csv_preview = df.head(15).to_csv(index=False)

    system_prompt = """You are FairLens, an expert, autonomous AI Bias Auditor.
You specialize in explaining technical fairness metrics in simple, clear language for non-technical audiences (HR, managers, regulators, judges).

Your strengths:
- Turn numbers and Fairlearn metrics into real-world stories
- Give honest severity assessments with justification
- Provide practical, actionable fix recommendations
- Use real-world examples of harm (loans, jobs, healthcare, criminal justice)
- Always be direct, empathetic, and solution-oriented

You have access to tools to dig deeper when needed (group stats, proxies, mitigation code). Use them proactively if the bias_results are unclear or you need more evidence."""

    user_input = f"""Perform a complete fairness audit on this dataset.

=== BIAS ANALYSIS RESULTS ===
{bias_summary}

=== DATASET PREVIEW ===
{csv_preview if csv_preview else "Preview not available"}

Task:
1. Explain the findings in plain, simple English.
2. Highlight the most problematic attributes and why they matter.
3. Give concrete real-world examples of how this bias can harm people.
4. Assess overall severity (Critical / High / Moderate / Low) with reasoning.
5. Provide 3-5 specific, actionable steps to fix the bias (use tools if needed for better suggestions).
6. End with an overall Fairness Rating out of 10 and a short justification.

Output **strictly** in this exact format:

🔍 WHAT WE FOUND
[Clear, non-technical explanation]

⚠️ REAL WORLD IMPACT
[2-3 concrete examples of potential harm]

📊 SEVERITY ASSESSMENT
[Critical / High / Moderate / Low] — [brief explanation why]

🛠️ HOW TO FIX IT
1. [Actionable step]
2. [Actionable step]
...

⭐ FAIRNESS RATING: X/10
[One-line justification]

Be helpful, direct, and professional. Avoid heavy jargon."""

    # Run the agent (it can now use tools autonomously)
    response = await agent.ainvoke({
        "messages": [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_input)
        ]
    })

    # Extract the final answer
    final_report = response["messages"][-1].content
    return final_report