import React from 'react'
import { ShieldAlert, Info } from 'lucide-react'

export function SkeletonLoader() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 w-1/3 rounded bg-slate-700/50" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-slate-800/50" />
        <div className="h-3 w-full rounded bg-slate-800/50" />
        <div className="h-3 w-4/5 rounded bg-slate-800/50" />
      </div>
      <div className="mt-6 h-4 w-1/4 rounded bg-slate-700/50" />
      <div className="grid grid-cols-1 gap-2">
        <div className="h-10 rounded border border-slate-800 bg-slate-800/30" />
        <div className="h-10 rounded border border-slate-800 bg-slate-800/30" />
      </div>
    </div>
  )
}

class SummaryErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('ExecutiveSummary render error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/5 p-8 text-center">
          <ShieldAlert className="mb-2 h-8 w-8 text-rose-500" />
          <p className="text-sm font-medium text-rose-300">Analysis Component Failure</p>
          <p className="mt-1 text-xs text-slate-400">The reasoning engine returned incompatible or empty data.</p>
        </div>
      )
    }
    return this.props.children
  }
}

function SummaryContent({ summary, redFlags }) {
  // Trigger error boundary if summary is empty or only whitespace
  if (!summary || !summary.trim()) {
    throw new Error('Empty summary from LLM.')
  }

  // Simple parser to turn LLM markdown-ish text into styled JSX
  const formatText = (text) => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} className="h-2" />;

      // Match "1. **Title**" or "### Title" patterns
      const headingMatch = trimmed.match(/^(\d+\.|###)\s*\*\*(.*)\*\*|^(\d+\.|###)\s*(.*)/);
      if (headingMatch) {
        const title = headingMatch[2] || headingMatch[4];
        return (
          <h4 key={i} className="mt-4 mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-cyan-400">
            <span className="h-1 w-1 bg-cyan-400" />
            {title}
          </h4>
        );
      }

      // Match bullet points
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.replace(/^[-*]\s*/, '');
        return (
          <div key={i} className="ml-2 mb-1 flex items-start gap-2 text-sm text-slate-300">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
            <span>{parseBoldText(content)}</span>
          </div>
        );
      }

      return (
        <p key={i} className="mb-2 text-sm leading-relaxed text-slate-300">
          {parseBoldText(trimmed)}
        </p>
      );
    });
  };

  const parseBoldText = (text) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-cyan-200">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 duration-700">
      <div className="relative rounded-xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur-sm">
        <div className="absolute -left-[1px] top-4 h-8 w-[2px] bg-cyan-400" />
        <div className="summary-body overflow-hidden">
          {formatText(summary)}
        </div>
      </div>

      {redFlags && redFlags.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-rose-500/20 pb-2">
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-rose-400">Critical Red Flags</h4>
          </div>
          <ul className="grid gap-2">
            {redFlags.map((flag, idx) => (
              <li 
                key={`${idx}-${flag}`} 
                className="group flex items-start gap-3 rounded-lg border border-rose-500/10 bg-slate-900/40 p-3 transition-all hover:border-rose-500/30 hover:bg-rose-500/5"
              >
                <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                <span className="text-sm text-slate-300 group-hover:text-slate-100 leading-snug">{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function ExecutiveSummary({ loading, summary, redFlags, status }) {
  if (loading) {
    return <SkeletonLoader />
  }

  if (status && status !== 'complete') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4 text-cyan-300">
        <Info className="h-5 w-5 animate-pulse" />
        <p className="text-sm font-medium">Analysis Status: <span className="uppercase">{status}</span></p>
      </div>
    )
  }

  return (
    <SummaryErrorBoundary>
      <SummaryContent summary={summary} redFlags={redFlags} />
    </SummaryErrorBoundary>
  )
}
