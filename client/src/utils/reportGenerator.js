/**
 * ReportGenerator Utility
 * Handles data preparation and markdown generation for fairness audit reports.
 */

export const prepareReportContext = (data) => {
  const {
    biasScores = [],
    agentSummary = '',
    mitigationResults = null,
    sensitiveAttribute = 'Not Selected',
    targetColumn = 'Not Selected',
    datasetId = 'N/A',
    comprehensiveAnalysis = null,
  } = data;

  return {
    title: 'Neural Stack Fairness Audit Report',
    timestamp: new Date().toLocaleString(),
    metadata: {
      datasetId,
      sensitiveAttribute,
      targetColumn
    },
    sections: {
      biasAnalysis: biasScores.length > 0 ? biasScores : 'Analysis Pending',
      executiveSummary: agentSummary.trim() || 'Analysis Pending',
      mitigation: mitigationResults || 'Analysis Pending',
      comprehensiveAnalysis,
    }
  };
};

const normalizeValue = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A'
  }
  return value
}

const toPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A'
  }
  return `${(Number(value) * 100).toFixed(2)}%`
}

const summarizeRecommendations = (verdict, diRatio, spd) => {
  const recommendations = []

  if (verdict !== 'Fair') {
    recommendations.push('Apply re-weighting to reduce disparity across sensitive groups.')
    recommendations.push('Review feature importance and remove or constrain any proxy-like features.')
    recommendations.push('If class imbalance exists, oversample the minority group or rebalance the training set.')
  } else {
    recommendations.push('Continue monitoring selection rates on future model versions.')
    recommendations.push('Document the current fairness baseline before deployment.')
  }

  if (diRatio !== null && diRatio !== undefined && Number(diRatio) < 0.8) {
    recommendations.push('Prioritize remediation because the 80% rule is not satisfied.')
  }

  if (spd !== null && spd !== undefined && Math.abs(Number(spd)) > 0.1) {
    recommendations.push('Recalibrate the decision threshold to reduce outcome skew.')
  }

  return recommendations.slice(0, 4)
}

export const generateMarkdown = (context) => {
  const { title, timestamp, metadata, sections } = context;
  const comprehensive = sections.comprehensiveAnalysis || {};
  const overview = comprehensive.overview || {};
  const groupDistribution = comprehensive.group_distribution || {};
  const riskRates = comprehensive.risk_rates || {};
  const verdict = comprehensive.verdict || 'High Bias';
  const metrics = comprehensive.metrics || {};
  const diRatio = metrics.disparate_impact_ratio ?? null;
  const spd = metrics.statistical_parity_difference ?? null;
  const referenceGroup = metrics.reference_group || 'N/A';
  const comparisonGroup = metrics.comparison_group || 'N/A';
  const rows = overview.total_rows ?? 'N/A';
  const missingValues = overview.missing_values ?? 'N/A';
  const columns = Array.isArray(overview.columns) ? overview.columns : [];
  const recommendations = summarizeRecommendations(verdict, diRatio, spd);

  let markdown = `# ${title}\n\n`;
  markdown += `**Generated on:** ${timestamp}\n`;
  markdown += `**Dataset ID:** \`${metadata.datasetId}\`\n`;
  markdown += `**Sensitive Attribute:** \`${metadata.sensitiveAttribute}\`\n`;
  markdown += `**Target Column:** \`${metadata.targetColumn}\`\n\n`;

  markdown += `## Audit Synopsis\n\n`;
  markdown += `| Metric | Value |\n`;
  markdown += `| :--- | :---: |\n`;
  markdown += `| Total Rows | ${rows} |\n`;
  markdown += `| Missing Values | ${missingValues} |\n`;
  markdown += `| Columns | ${columns.length} |\n`;
  markdown += `| Verdict | ${verdict} |\n`;
  markdown += `| DI Ratio | ${normalizeValue(diRatio) === 'N/A' ? 'N/A' : Number(diRatio).toFixed(3)} |\n`;
  markdown += `| SPD | ${normalizeValue(spd) === 'N/A' ? 'N/A' : Number(spd).toFixed(3)} |\n`;
  markdown += `| Reference Group | ${referenceGroup} |\n`;
  markdown += `| Comparison Group | ${comparisonGroup} |\n\n`;

  markdown += `## Executive Summary\n`;
  markdown += `${sections.executiveSummary}\n\n`;

  markdown += `## Statistical Snapshot\n\n`;
  markdown += `| Group | Count | Selection Rate |\n`;
  markdown += `| :--- | :---: | :---: |\n`;
  Object.entries(groupDistribution).forEach(([group, count]) => {
    const rate = riskRates[group]
    markdown += `| ${group} | ${count} | ${toPercent(rate)} |\n`;
  })
  markdown += `\n`;

  markdown += `## Findings\n\n`;
  markdown += `- The selection-rate gap is summarized above for quick managerial review.\n`;
  markdown += `- The 80% rule status is reflected in the verdict: **${verdict}**.\n`;
  markdown += `- Use the statistical snapshot to identify groups with materially lower selection rates.\n\n`;

  markdown += `## Recommendations\n\n`;
  markdown += `| Priority | Recommendation |\n`;
  markdown += `| :--- | :--- |\n`;
  recommendations.forEach((item, index) => {
    const priority = index === 0 ? 'High' : index === 1 ? 'Medium' : 'Low'
    markdown += `| ${priority} | ${item} |\n`;
  })
  markdown += `\n`;

  markdown += `## Notes\n`;
  markdown += `- Sensitive attribute: ${metadata.sensitiveAttribute}.\n`;
  markdown += `- Target column: ${metadata.targetColumn}.\n`;
  markdown += `- Report generated for presentation and review purposes.\n\n`;

  markdown += `---\n*Report generated by Neural Stack AI Agent Console*`;

  return markdown;
};

export const downloadMarkdown = (content, filename = 'fairness-audit-report.md') => {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
