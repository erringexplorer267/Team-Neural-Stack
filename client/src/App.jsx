import React, { useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { AlertCircle, CheckCircle, Loader, Cpu, Radar, ShieldAlert, Activity, UploadCloud } from 'lucide-react'
import { fetchAPI, uploadCSV } from './api'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts'
import LiveAgentConsole from './components/LiveAgentConsole'
import ExecutiveSummary from './components/ExecutiveSummary'
import ReportModal from './components/ReportModal'
import { prepareReportContext, generateMarkdown } from './utils/reportGenerator'

export default function App() {
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
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState(null)
  const [selectionRateData, setSelectionRateData] = useState([])
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

  const onDrop = async (acceptedFiles) => {
    const [file] = acceptedFiles
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const result = await uploadCSV(file)
      setUploadedFileName(file.name)
      setDataId(result.id)
      setColumns(result.columns || [])
      setSelectedSensitiveAttribute((result.columns && result.columns[0]) || '')
      setTargetColumn((result.columns && result.columns[0]) || '')
      setSelectionRateData([])
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
    } catch (err) {
      setUploadError(err.message)
      setDataId(null)
      setColumns([])
      setSelectedSensitiveAttribute('')
    } finally {
      setUploading(false)
    }
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
      const chartData = Object.entries(rates).map(([group, rate]) => ({
        group,
        selectionRate: Number(rate),
      }))
      setSelectionRateData(chartData)
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
      // Gather data for the report
      const contextData = {
        biasScores: selectionRateData,
        agentSummary: executiveSummary,
        mitigationResults: mitigationResults,
        sensitiveAttribute: selectedSensitiveAttribute,
        targetColumn: targetColumn,
        datasetId: dataId
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
    <div className="min-h-screen w-full bg-slate-950 text-slate-200">
      <div className="mx-auto grid min-h-screen max-w-[1400px] grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-cyan-400/20 bg-slate-900/70 p-6 backdrop-blur-lg lg:border-b-0 lg:border-r">
          <div className="mb-10 flex items-center gap-3">
            <div className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 p-2">
              <Cpu className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide text-cyan-400">NEURAL STACK</h1>
              <p className="text-xs uppercase text-slate-400">Cyber Fairness Console</p>
            </div>
          </div>

          <nav className="space-y-3 text-sm">
            <div className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-cyan-300">
              Dashboard
            </div>
            <div className="rounded-md border border-slate-700 px-3 py-2 text-slate-300">Upload Dataset</div>
            <div className="rounded-md border border-slate-700 px-3 py-2 text-slate-300">Bias Analysis</div>
            <div className="rounded-md border border-slate-700 px-3 py-2 text-slate-300">Mitigation Lab</div>
            <div className="rounded-md border border-slate-700 px-3 py-2 text-slate-300">Reasoning Trace</div>
          </nav>

          <div className="mt-10 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              <p className="text-sm font-semibold text-rose-300">Risk Watch</p>
            </div>
            <p className="text-xs text-slate-300">Monitor high-impact bias signals and mitigation deltas in real time.</p>
          </div>
        </aside>

        <main className="p-6 lg:p-8">
          <header className="mb-6 rounded-xl border border-cyan-400/20 bg-slate-900/60 p-5 shadow-[0_0_40px_rgba(34,211,238,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-400">System Overview</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-100">Bias Intelligence Dashboard</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1">
                <Activity className="h-4 w-4 text-cyan-300" />
                <span className="text-xs font-medium text-cyan-300">LIVE SIGNAL</span>
              </div>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-cyan-400/20 bg-slate-900/50 p-4">
              <p className="text-xs uppercase text-slate-400">Primary Theme</p>
              <p className="mt-2 font-semibold text-slate-100">Slate-950 + Slate-200</p>
            </div>
            <div className="rounded-lg border border-cyan-400/20 bg-slate-900/50 p-4">
              <p className="text-xs uppercase text-slate-400">Accent Channel</p>
              <p className="mt-2 font-semibold text-cyan-400">Cyan-400</p>
            </div>
            <div className="rounded-lg border border-rose-500/20 bg-slate-900/50 p-4">
              <p className="text-xs uppercase text-slate-400">Alert Channel</p>
              <p className="mt-2 font-semibold text-rose-400">Rose-500</p>
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <div className="rounded-xl border border-cyan-400/20 bg-slate-900/60 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Radar className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-slate-100">Backend Link Status</h3>
              </div>
              <div className="space-y-3">
                {loading && (
                  <div className="flex items-center gap-3 rounded-lg border border-cyan-400/25 bg-cyan-400/10 p-4">
                    <Loader className="h-5 w-5 animate-spin text-cyan-400" />
                    <span className="text-cyan-200">Establishing API uplink...</span>
                  </div>
                )}

                {!loading && apiStatus && (
                  <div className="flex items-start gap-3 rounded-lg border border-cyan-400/25 bg-cyan-400/10 p-4">
                    <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-400" />
                    <div>
                      <p className="font-medium text-cyan-300">Connection Stable</p>
                      <p className="mt-1 text-sm text-slate-300">
                        <code className="rounded bg-slate-800 px-2 py-1 text-cyan-300">{apiStatus.message}</code>
                      </p>
                    </div>
                  </div>
                )}

                {!loading && error && (
                  <div className="flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-400" />
                    <div>
                      <p className="font-medium text-rose-300">Connection Failed</p>
                      <p className="mt-1 text-sm text-slate-300">
                        Start backend: <code className="rounded bg-slate-800 px-2 py-1 text-rose-300">uvicorn server.main:app --reload</code>
                      </p>
                      <p className="mt-2 text-xs text-rose-300">{error}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-cyan-400/20 bg-slate-900/60 p-6">
              <h3 className="mb-4 text-lg font-semibold text-slate-100">System Telemetry</h3>
              <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950/80 p-4 font-mono text-xs text-slate-300">
                <p>React: {React.version}</p>
                <p>Vite: Ready</p>
                <p>Tailwind: Global Theme Active</p>
                <p className="text-cyan-400">API_BASE: http://127.0.0.1:8000</p>
                {apiStatus && <p className="text-cyan-300">Backend: Connected</p>}
                {error && <p className="text-rose-400">Backend: Error</p>}
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <div className="rounded-xl border border-cyan-400/20 bg-slate-900/60 p-6">
              <div className="mb-4 flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-slate-100">Dataset Upload</h3>
              </div>

              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
                  isDragActive
                    ? 'border-cyan-400 bg-cyan-400/10'
                    : 'border-cyan-400/30 bg-slate-950/70 hover:border-cyan-400/60'
                }`}
              >
                <input {...getInputProps()} />
                <p className="text-sm text-slate-300">
                  {isDragActive ? 'Drop the CSV file here...' : 'Drag & drop a CSV file here, or click to select'}
                </p>
                <p className="mt-2 text-xs text-slate-400">Only .csv files are supported</p>
              </div>

              {uploading && (
                <div className="mt-4 flex items-center gap-2 text-cyan-300">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Uploading dataset...</span>
                </div>
              )}

              {uploadedFileName && dataId && !uploading && (
                <div className="mt-4 rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-3 text-sm text-cyan-200">
                  Uploaded <span className="font-semibold">{uploadedFileName}</span> | data_id: <code>{dataId}</code>
                </div>
              )}

              {uploadError && (
                <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
                  {uploadError}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-cyan-400/20 bg-slate-900/60 p-6">
              <h3 className="mb-4 text-lg font-semibold text-slate-100">Select Sensitive Attribute</h3>
              <label className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Sensitive Column</label>
              <select
                value={selectedSensitiveAttribute}
                onChange={(e) => setSelectedSensitiveAttribute(e.target.value)}
                disabled={columns.length === 0}
                className="w-full rounded-lg border border-cyan-400/30 bg-slate-950 px-3 py-2 text-slate-200 outline-none ring-cyan-400/40 focus:ring"
              >
                {columns.length === 0 ? (
                  <option value="">Upload CSV first</option>
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
                  <option value="">Upload CSV first</option>
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

          <section className="mt-6 rounded-xl border border-cyan-400/20 bg-slate-900/60 p-6">
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

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
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

            <div className="rounded-xl border border-cyan-400/20 bg-slate-900/60 p-6">
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

          <section className="mt-6 rounded-xl border border-cyan-400/20 bg-slate-900/60 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-100">Audit Report</h3>
              <button
                type="button"
                onClick={downloadAuditReport}
                disabled={reportLoading || !dataId}
                className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-300 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reportLoading ? 'Generating...' : 'Download Audit Report'}
              </button>
            </div>
            {reportError && <p className="mt-3 text-xs text-rose-300">{reportError}</p>}
            {!reportError && (
              <p className="mt-3 text-xs text-slate-400">
                Generates markdown from AI narrative + chart data and opens a copy-ready modal.
              </p>
            )}
          </section>
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
