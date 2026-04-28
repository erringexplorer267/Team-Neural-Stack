import React from 'react'
import { AlertTriangle, CheckCircle, ShieldAlert, BarChart3, Table2, Sparkles } from 'lucide-react'

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A'
  }
  return `${(Number(value) * 100).toFixed(2)}%`
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A'
  }
  return Number(value).toFixed(3)
}

function formatListValue(value) {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (value === null || value === undefined) {
    return 'N/A'
  }
  return String(value)
}

function buildFairnessScore(disparateImpactRatio, statisticalParityDifference) {
  if (disparateImpactRatio === null || disparateImpactRatio === undefined || Number.isNaN(Number(disparateImpactRatio))) {
    return 0
  }

  const di = Number(disparateImpactRatio)
  const spdPenalty = Math.min(40, Math.abs(Number(statisticalParityDifference || 0)) * 120)
  const diScore = di >= 1 ? 100 : clamp(Math.round(di * 100), 0, 100)
  return clamp(Math.round(diScore - spdPenalty / 2), 0, 100)
}

function getVerdictTone(verdict) {
  if (verdict === 'Fair') {
    return {
      icon: CheckCircle,
      label: 'Fair',
      wrapper: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
      iconClass: 'text-emerald-400',
    }
  }

  if (verdict === 'Caution') {
    return {
      icon: AlertTriangle,
      label: 'Caution',
      wrapper: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
      iconClass: 'text-amber-400',
    }
  }

  return {
    icon: ShieldAlert,
    label: verdict || 'High Bias',
    wrapper: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    iconClass: 'text-rose-400',
  }
}

function MetricCard({ label, value, accent = 'text-cyan-400', subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_0_24px_rgba(8,15,28,0.45)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{label}</p>
        <Sparkles className={`h-4 w-4 ${accent}`} />
      </div>
      <div className={`mt-4 text-3xl font-semibold tabular-nums ${accent}`}>{value}</div>
      {subtitle ? <p className="mt-2 text-xs leading-5 text-slate-400">{subtitle}</p> : null}
    </div>
  )
}

function DataTable({ title, columns, rows, emptyText }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 shadow-[0_0_24px_rgba(8,15,28,0.35)]">
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <Table2 className="h-4 w-4 text-cyan-400" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800 text-left">
          <thead className="bg-slate-900/70 text-[11px] uppercase tracking-[0.22em] text-slate-400">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-sm text-slate-200">
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <tr key={`${title}-${index}`} className="transition-colors hover:bg-cyan-500/5">
                  {row.map((cell, cellIndex) => (
                    <td key={`${title}-${index}-${cellIndex}`} className="px-4 py-3 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-sm text-slate-500" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function BiasDashboard({ analysis, className = '' }) {
  const overview = analysis?.overview || {}
  const metrics = analysis?.metrics || {}
  const groupDistribution = analysis?.group_distribution || {}
  const riskRates = analysis?.risk_rates || {}
  const verdict = analysis?.verdict || 'High Bias'
  const narrative = analysis?.explanation || analysis?.narrative || ''

  const diRatio = metrics?.disparate_impact_ratio ?? analysis?.disparate_impact_ratio ?? null
  const spd = metrics?.statistical_parity_difference ?? analysis?.statistical_parity_difference ?? null
  const fairnessScore = buildFairnessScore(diRatio, spd)
  const verdictTone = getVerdictTone(verdict)
  const VerdictIcon = verdictTone.icon

  const distributionRows = Object.entries(groupDistribution).map(([group, count]) => [
    <span key={group} className="font-medium text-slate-100">{group}</span>,
    <span key={`${group}-count`} className="tabular-nums text-cyan-300">{count}</span>,
  ])

  const riskRows = Object.entries(riskRates).map(([group, rate]) => [
    <span key={group} className="font-medium text-slate-100">{group}</span>,
    <span key={`${group}-risk`} className="tabular-nums text-cyan-300">{formatPercent(rate)}</span>,
  ])

  const columns = Array.isArray(overview.columns) ? overview.columns : []
  const missingValues = overview.missing_values ?? 0
  const totalRows = overview.total_rows ?? 0

  return (
    <section className={`rounded-3xl border border-cyan-400/20 bg-slate-950 p-6 text-slate-100 shadow-[0_0_40px_rgba(34,211,238,0.08)] ${className}`}>
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-cyan-400">Bias Dashboard</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-50">Comprehensive Fairness Analysis</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Review the overall fairness signal, the sensitive-attribute distribution, and the model-selection pressure across groups.
            </p>
          </div>

          <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${verdictTone.wrapper}`}>
            <VerdictIcon className={`h-5 w-5 ${verdictTone.iconClass}`} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-80">Verdict</p>
              <p className="text-sm font-semibold">{verdictTone.label}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">Rows: {totalRows}</span>
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">Missing values: {missingValues}</span>
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">Columns: {columns.length}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="DI Ratio"
          value={formatNumber(diRatio)}
          accent="text-cyan-400"
          subtitle="Disparate impact relative to the reference group. Values below 0.80 indicate potential adverse impact."
        />
        <MetricCard
          label="SPD"
          value={formatNumber(spd)}
          accent="text-cyan-300"
          subtitle="Statistical Parity Difference between the lowest-risk group and the reference group."
        />
        <MetricCard
          label="Fairness Score"
          value={`${fairnessScore}`
          }
          accent="text-cyan-200"
          subtitle="A normalized 0-100 score derived from DI and SPD for quick executive review."
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <DataTable
          title="Group Distribution"
          columns={['Group', 'Count']}
          rows={distributionRows}
          emptyText="No group distribution data available."
        />

        <DataTable
          title="High-Risk Rates"
          columns={['Group', 'Selection Rate']}
          rows={riskRows}
          emptyText="No risk-rate data available."
        />
      </div>

      <div className="mt-6 rounded-2xl border-l-4 border-cyan-400 bg-slate-900/70 p-5 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.06)]">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">Narrative</h3>
        </div>
        <p className="text-sm leading-7 text-slate-200">
          {narrative || 'No explanation was provided for this dataset yet.'}
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">Overview</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Total Rows</p>
            <p className="mt-2 text-lg font-semibold text-slate-100 tabular-nums">{totalRows}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Missing Values</p>
            <p className="mt-2 text-lg font-semibold text-slate-100 tabular-nums">{missingValues}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Reference Group</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">{formatListValue(metrics?.reference_group)}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Comparison Group</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">{formatListValue(metrics?.comparison_group)}</p>
          </div>
        </div>
      </div>
    </section>
  )
}