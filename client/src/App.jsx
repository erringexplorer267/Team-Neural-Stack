import React, { useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { AlertCircle, CheckCircle, Loader, Cpu, Radar, ShieldAlert, Activity, UploadCloud } from 'lucide-react'
import { API_BASE, fetchAPI, uploadCSV } from './api'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts'
import LiveAgentConsole from './components/LiveAgentConsole'
import ExecutiveSummary from './components/ExecutiveSummary'
import ReportModal from './components/ReportModal'
import ManualDataEntry from './components/ManualDataEntry'
import BiasDashboard from './components/BiasDashboard'
import { prepareReportContext, generateMarkdown } from './utils/reportGenerator'

export default function App() {
  const overviewRef = useRef(null)
  const uploadRef = useRef(null)
  const analysisRef = useRef(null)
  const reasoningRef = useRef(null)
  const reportRef = useRef(null)

  const [apiStatus, setApiStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [dataId, setDataId] = useState(null)
  const [columns, setColumns] = useState([])
  const [selectedSensitiveAttribute, setSelectedSensitiveAttribute] = useState('')
  const [targetColumn, setTargetColumn] = useState('')
  const [datasetMode, setDatasetMode] = useState('csv')
  const [activeSection, setActiveSection] = useState('overview')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState(null)
  const [selectionRateData, setSelectionRateData] = useState([])
  const [comprehensiveAnalysis, setComprehensiveAnalysis] = useState(null)
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentError, setAgentError] = useState(null)
  const [thinkingLog, setThinkingLog] = useState([])
  const [executiveSummary, setExecutiveSummary] = useState('')
  const [redFlags, setRedFlags] = useState([])
  const [agentStatus, setAgentStatus] = useState('')
  const [narrativeText, setNarrativeText] = useState('')
  const [mitigationResults, setMitigationResults] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState(null)
  const [reportMarkdown, setReportMarkdown] = useState('')
  const [showReportModal, setShowReportModal] = useState(false)

  const resetWorkflowState = () => {
    setSelectionRateData([])
    setComprehensiveAnalysis(null)
    setAnalysisError(null)
    setThinkingLog([])
    setExecutiveSummary('')
    setRedFlags([])
    setAgentStatus('')
    setAgentError(null)
    setNarrativeText('')
    setMitigationResults(null)
    setReportError(null)
    setReportMarkdown('')
    setShowReportModal(false)
  }

  const hydrateDataset = (result, label) => {
    const incomingColumns = result?.columns || []
    const detectedSensitive = result?.potential_sensitive_attributes?.[0] || incomingColumns[0] || ''
    const detectedTarget = incomingColumns.find((column) => /target|label|outcome|yhat|score|decision/i.test(column)) || incomingColumns[1] || incomingColumns[0] || ''
    const safeTarget = detectedTarget === detectedSensitive && incomingColumns.length > 1
      ? incomingColumns.find((column) => column !== detectedSensitive) || detectedTarget
      : detectedTarget

    setUploadedFileName(label)
    setDataId(result?.id || null)
    setColumns(incomingColumns)
    setSelectedSensitiveAttribute(detectedSensitive)
    setTargetColumn(safeTarget)
    resetWorkflowState()
  }

  const onDrop = async (acceptedFiles) => {
    const [file] = acceptedFiles
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const result = await uploadCSV(file)
      hydrateDataset(result, file.name)
      setDatasetMode('csv')
    } catch (err) {
      setUploadError(err.message)
      setDataId(null)
      setColumns([])
      setSelectedSensitiveAttribute('')
      setTargetColumn('')
    } finally {
      setUploading(false)
    }
  }

  const handleManualDataUploaded = (result, label = 'manual dataset') => {
    hydrateDataset(result, label)
    setDatasetMode('manual')
  }

  const scrollToSection = (ref, sectionKey) => {
    setActiveSection(sectionKey)
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
  })

  const runFairnessAnalysis = async () => {
    if (!dataId || !targetColumn || !selectedSensitiveAttribute) return
    setAnalyzing(true)
    setAnalysisError(null)
    try {
      const result = await fetchAPI('/analyze', {
        method: 'POST',
        body: JSON.stringify({
          data_id: dataId,
          target_column: targetColumn,
          sensitive_column: selectedSensitiveAttribute,
        }),
      })
      const rates = result?.analysis?.selection_rates || {}
      const comp = result?.comprehensive_analysis || null
      setComprehensiveAnalysis(comp)
      const chartData = Object.entries(rates).map(([group, rate]) => ({
        group,
        selectionRate: Number(rate),
      }))
      setSelectionRateData(chartData)
      await runNarrative()
    } catch (err) {
      setAnalysisError(err.message)
      setSelectionRateData([])
    } finally {
      setAnalyzing(false)
    }
  }

  const runAgentReasoning = async () => {
    if (!dataId || !selectedSensitiveAttribute) return
    setAgentLoading(true)
    setAgentError(null)
    setThinkingLog([])
    setExecutiveSummary('')
    setRedFlags([])
    setAgentStatus('')
    try {
      const result = await fetchAPI('/agent-reasoning', {
        method: 'POST',
        body: JSON.stringify({ data_id: dataId, sensitive_attribute: selectedSensitiveAttribute }),
      })
      setExecutiveSummary(result?.summary || '')
      setRedFlags(result?.red_flags || [])
      setAgentStatus(result?.status || '')
    } catch (err) {
      setAgentError(err.message)
      setExecutiveSummary('')
      setRedFlags([])
      setAgentStatus('')
    } finally {
      setAgentLoading(false)
    }
  }

  useEffect(() => {
    if (dataId && selectedSensitiveAttribute) {
      runAgentReasoning()
    }
  }, [dataId, selectedSensitiveAttribute])

  const runNarrative = async () => {
    if (!dataId || !targetColumn || !selectedSensitiveAttribute) return
    setReportError(null)
    try {
      const result = await fetchAPI('/narrative', {
        method: 'POST',
        body: JSON.stringify({
          data_id: dataId,
          target_column: targetColumn,
          sensitive_column: selectedSensitiveAttribute,
        }),
      })
      const generatedNarrative = result?.narrative || ''
      setNarrativeText(generatedNarrative)
      return generatedNarrative
    } catch (err) {
      setReportError(err.message)
      return ''
    }
  }

  const downloadAuditReport = async () => {
    setReportLoading(true)
    setReportError(null)
    
    try {
      const generatedNarrative = narrativeText || await runNarrative()
      const contextData = {
        biasScores: selectionRateData,
        agentSummary: generatedNarrative || comprehensiveAnalysis?.explanation || executiveSummary,
        mitigationResults: mitigationResults,
        sensitiveAttribute: selectedSensitiveAttribute,
        targetColumn: targetColumn,
        datasetId: dataId,
        comprehensiveAnalysis,
      }

      const context = prepareReportContext(contextData)
      const markdown = generateMarkdown(context)

      setReportMarkdown(markdown)
      setShowReportModal(true)
    } catch (err) {
      setReportError('Failed to generate report: ' + err.message)
    } finally {
      setReportLoading(false)
    }
  }

  const copyReportMarkdown = async () => {
    if (!reportMarkdown) return
    try {
      await navigator.clipboard.writeText(reportMarkdown)
    } catch (err) {
      console.error('Failed to copy markdown:', err)
    }
  }

  useEffect(() => {
    console.log('App mounted - testing API connection and Tailwind CSS')

    // Test backend connectivity
    const testAPI = async () => {
      setLoading(true)
      try {
        const data = await fetchAPI('/')
        console.log('API test successful:', data)
        setApiStatus(data)
        setError(null)
      } catch (err) {
        console.error('API test failed:', err)
        setError(err.message)
        setApiStatus(null)
      } finally {
        setLoading(false)
      }
    }

    testAPI()
  }, [])

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.12),transparent_25%),radial-gradient(circle_at_75%_82%,rgba(244,63,94,0.12),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40" />

      <div className="relative mx-auto grid min-h-screen max-w-[1520px] grid-cols-1 lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-cyan-400/15 bg-slate-950/75 p-6 backdrop-blur-xl lg:border-b-0 lg:border-r lg:border-slate-800/80">
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-cyan-400/20 bg-slate-900/60 p-4 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
            <div className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 p-2">
              <Cpu className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-[0.22em] text-cyan-300">NEURAL STACK</h1>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Bias intelligence console</p>
            </div>
          </div>

          <nav className="space-y-2 text-sm">
            {[
              { key: 'overview', label: 'Overview', ref: overviewRef },
              { key: 'upload', label: 'Upload Dataset', ref: uploadRef },
              { key: 'analysis', label: 'Bias Analysis', ref: analysisRef },
              { key: 'reasoning', label: 'Reasoning Trace', ref: reasoningRef },
              { key: 'report', label: 'Audit Report', ref: reportRef },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => scrollToSection(item.ref, item.key)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${activeSection === item.key
                  ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.08)]'
                  : 'border-slate-800/80 bg-slate-900/50 text-slate-300 hover:border-cyan-400/20 hover:bg-slate-900/80'
                }`}
              >
                <span>{item.label}</span>
                <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Go</span>
              </button>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-rose-500/20 bg-rose-500/8 p-4">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              <p className="text-sm font-semibold text-rose-300">Risk Watch</p>
            </div>
            <p className="text-xs leading-6 text-slate-300">Monitor high-impact bias signals, group separation, and mitigation deltas in one place.</p>
          </div>
        </aside>

        <main className="space-y-6 p-6 lg:p-8">
          <header ref={overviewRef} className="rounded-3xl border border-cyan-400/15 bg-slate-900/55 p-6 shadow-[0_0_40px_rgba(34,211,238,0.08)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-400">System Overview</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">Bias Intelligence Dashboard</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Upload a CSV or enter a dataset manually, then run fairness analysis, reasoning, and reporting without leaving the dashboard.</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2">
                <Activity className="h-4 w-4 text-cyan-300" />
                <span className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300">Live Signal</span>
              </div>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-400/15 bg-slate-900/55 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase text-slate-400">Primary Theme</p>
              <p className="mt-2 font-semibold text-slate-100">Deep slate with cyan accents</p>
            </div>
            <div className="rounded-2xl border border-cyan-400/15 bg-slate-900/55 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase text-slate-400">Accent Channel</p>
              <p className="mt-2 font-semibold text-cyan-400">Cyan + blue signal layer</p>
            </div>
            <div className="rounded-2xl border border-rose-500/20 bg-slate-900/55 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase text-slate-400">Alert Channel</p>
              <p className="mt-2 font-semibold text-rose-400">Rose for risk states</p>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <div className="rounded-3xl border border-cyan-400/15 bg-slate-900/55 p-6 backdrop-blur-xl" ref={uploadRef}>
              <div className="mb-4 flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-slate-100">Dataset Upload</h3>
              </div>

              <div className="mb-5 inline-flex rounded-full border border-slate-800 bg-slate-950/80 p-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <button
                  type="button"
                  onClick={() => setDatasetMode('csv')}
                  className={`rounded-full px-4 py-2 transition ${datasetMode === 'csv' ? 'bg-cyan-400 text-slate-950' : 'hover:text-slate-200'}`}
                >
                  CSV Upload
                </button>
                <button
                  type="button"
                  onClick={() => setDatasetMode('manual')}
                  className={`rounded-full px-4 py-2 transition ${datasetMode === 'manual' ? 'bg-cyan-400 text-slate-950' : 'hover:text-slate-200'}`}
                >
                  Manual Entry
                </button>
              </div>

              {datasetMode === 'csv' ? (
                <div
                  {...getRootProps()}
                  className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
                    isDragActive
                      ? 'border-cyan-400 bg-cyan-400/10'
                      : 'border-cyan-400/25 bg-slate-950/70 hover:border-cyan-400/60'
                  }`}
                >
                  <input {...getInputProps()} />
                  <p className="text-sm text-slate-200">
                    {isDragActive ? 'Drop the CSV file here...' : 'Drag and drop a CSV file, or click to browse'}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-slate-400">Uploaded files are analyzed by the same fairness pipeline used for manual datasets.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-cyan-400/15 bg-slate-950/70 p-4">
                  <ManualDataEntry onDataUploaded={handleManualDataUploaded} />
                </div>
              )}

              {uploading && (
                <div className="mt-4 flex items-center gap-2 text-cyan-300">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Uploading dataset...</span>
                </div>
              )}

              {uploadedFileName && dataId && !uploading && (
                <div className="mt-4 rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-3 text-sm text-cyan-200">
                  Loaded <span className="font-semibold">{uploadedFileName}</span> | data_id: <code>{dataId}</code>
                </div>
              )}

              {uploadError && (
                <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
                  {uploadError}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-cyan-400/15 bg-slate-900/55 p-6 backdrop-blur-xl">
              <h3 className="mb-4 text-lg font-semibold text-slate-100">Select Sensitive Attribute</h3>
              <label className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Sensitive Column</label>
              <select
                value={selectedSensitiveAttribute}
                onChange={(e) => setSelectedSensitiveAttribute(e.target.value)}
                disabled={columns.length === 0}
                className="w-full rounded-lg border border-cyan-400/30 bg-slate-950 px-3 py-2 text-slate-200 outline-none ring-cyan-400/40 focus:ring"
              >
                {columns.length === 0 ? (
                  <option value="">Upload or enter data first</option>
                ) : (
                  columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))
                )}
              </select>
              <p className="mt-3 text-xs text-slate-400">
                Columns loaded: <span className="text-cyan-300">{columns.length}</span>
              </p>

              <label className="mb-2 mt-5 block text-xs uppercase tracking-wide text-slate-400">Target Column</label>
              <select
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
                disabled={columns.length === 0}
                className="w-full rounded-lg border border-cyan-400/30 bg-slate-950 px-3 py-2 text-slate-200 outline-none ring-cyan-400/40 focus:ring"
              >
                {columns.length === 0 ? (
                  <option value="">Upload or enter data first</option>
                ) : (
                  columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                onClick={runFairnessAnalysis}
                disabled={!dataId || !targetColumn || !selectedSensitiveAttribute || analyzing}
                className="mt-5 w-full rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analyzing ? 'Running Analysis...' : 'Analyze Selection Rates'}
              </button>

              {analysisError && (
                <p className="mt-3 text-xs text-rose-300">{analysisError}</p>
              )}
            </div>
          </section>

          <section ref={analysisRef} className="rounded-3xl border border-cyan-400/15 bg-slate-900/55 p-6 backdrop-blur-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-100">Selection Rate by Group</h3>
            <p className="mb-4 text-xs uppercase tracking-wide text-slate-400">
              Fairness threshold (80% rule): <span className="text-cyan-300">0.8</span>
            </p>

            {selectionRateData.length === 0 ? (
              <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-8 text-center text-sm text-slate-400">
                Run analysis to visualize selection rates across groups.
              </div>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={selectionRateData} margin={{ top: 10, right: 20, left: 0, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="group" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" domain={[0, 1]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #22d3ee55',
                        color: '#e2e8f0',
                      }}
                      labelStyle={{ color: '#e2e8f0' }}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                    <ReferenceLine
                      y={0.8}
                      stroke="#f43f5e"
                      strokeDasharray="5 5"
                      label={{ value: 'Fairness Threshold 0.8', fill: '#fda4af', position: 'insideTopRight' }}
                    />
                    <Bar dataKey="selectionRate" radius={[6, 6, 0, 0]}>
                      {selectionRateData.map((entry) => (
                        <Cell
                          key={entry.group}
                          fill={entry.selectionRate >= 0.8 ? '#22d3ee' : '#f43f5e'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section ref={reasoningRef} className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Live Agent Console</h3>
                <button
                  type="button"
                  onClick={runAgentReasoning}
                  disabled={!dataId || agentLoading}
                  className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-300 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {agentLoading ? 'Investigating...' : 'Start Investigation'}
                </button>
              </div>
              <LiveAgentConsole lines={thinkingLog} loading={agentLoading} />
              {agentError && (
                <p className="mt-3 text-xs text-rose-300">{agentError}</p>
              )}
            </div>

            <div className="rounded-3xl border border-cyan-400/15 bg-slate-900/55 p-6 backdrop-blur-xl">
              <h3 className="mb-3 text-lg font-semibold text-slate-100">Executive Summary</h3>
              {dataId && selectedSensitiveAttribute ? (
                <ExecutiveSummary 
                  loading={agentLoading} 
                  summary={executiveSummary} 
                  redFlags={redFlags} 
                  status={agentStatus} 
                />
              ) : (
                <p className="text-sm text-slate-400">Select a sensitive attribute to generate a summary.</p>
              )}
            </div>
          </section>

          <section ref={reportRef} className="rounded-3xl border border-cyan-400/15 bg-slate-900/55 p-6 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-100">Audit Report</h3>
              <button
                type="button"
                onClick={downloadAuditReport}
                disabled={reportLoading || !dataId}
                className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-300 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reportLoading ? 'Generating...' : 'Generate Audit Report'}
              </button>
            </div>
            {reportError && <p className="mt-3 text-xs text-rose-300">{reportError}</p>}
            {!reportError && (
              <p className="mt-3 text-xs text-slate-400">
                Generates markdown from narrative, analysis, and chart data, then opens a copy-ready modal.
              </p>
            )}
          </section>

          {comprehensiveAnalysis && (
            <section className="rounded-3xl border border-cyan-400/15 bg-slate-900/55 p-6 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-400">Comprehensive View</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-100">Bias Dashboard</h3>
                </div>
                <button
                  type="button"
                  onClick={() => scrollToSection(reportRef, 'report')}
                  className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300 transition hover:bg-cyan-400/20"
                >
                  Review Report
                </button>
              </div>
              <BiasDashboard analysis={comprehensiveAnalysis} />
            </section>
          )}
        </main>
      </div>

      <ReportModal 
        isOpen={showReportModal} 
        onClose={() => setShowReportModal(false)} 
        markdown={reportMarkdown} 
      />
    </div>
  )
}
