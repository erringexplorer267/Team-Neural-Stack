import React, { useEffect, useState, useRef } from 'react'
import { Terminal } from 'lucide-react'

const LINE_DELAY_MS = 600

export default function LiveAgentConsole({ lines = [], loading }) {
  const [visibleLines, setVisibleLines] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef(null)

  // Use provided lines or default cyberpunk reasoning lines when loading
  const internalLines = lines.length > 0 ? lines : [
    'SYSTEM INITIALIZING...',
    'CONNECTING TO NEURAL STACK GATEWAY...',
    'AUTHENTICATING AGENT CREDENTIALS...',
    'SCANNING DATASET COLUMNS...',
    'DETECTING SENSITIVE PROXY VARIABLES...',
    'CALCULATING DISPARATE IMPACT RATIOS...',
    'ANALYZING STATISTICAL PARITY DIFFERENCES...',
    'GENERATING BIAS MITIGATION STRATEGIES...',
    'FINALIZING REASONING TRACE...'
  ]

  useEffect(() => {
    if (loading) {
      setVisibleLines([])
      setIsTyping(true)
      let currentLine = 0
      
      const interval = setInterval(() => {
        if (currentLine < internalLines.length) {
          setVisibleLines(prev => [...prev, internalLines[currentLine]])
          currentLine++
        } else {
          setIsTyping(false)
          clearInterval(interval)
        }
      }, LINE_DELAY_MS)

      return () => clearInterval(interval)
    } else {
      setIsTyping(false)
    }
  }, [loading, lines])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [visibleLines])

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-cyan-400 bg-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
      {/* Scanline Overlay */}
      <div 
        className="pointer-events-none absolute inset-0 z-10 opacity-10"
        style={{
          background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
          backgroundSize: '100% 4px, 3px 100%'
        }}
      />
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-400/30 bg-slate-900/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-400" />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400">Agent Reasoning Console v1.0.4</span>
        </div>
        <div className="flex gap-1.5">
          <div className="h-2 w-2 rounded-full bg-rose-500/50" />
          <div className="h-2 w-2 rounded-full bg-amber-500/50" />
          <div className="h-2 w-2 rounded-full bg-emerald-500/50" />
        </div>
      </div>

      {/* Terminal Content */}
      <div 
        ref={scrollRef}
        className="h-72 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-cyan-400/20"
      >
        <div className="space-y-1.5">
          {visibleLines.map((line, idx) => (
            <div key={idx} className="flex gap-3">
              <span className="shrink-0 text-cyan-500/50">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
              <span className="shrink-0 text-emerald-400 tracking-wider font-bold">{'>'}</span>
              <span className="text-cyan-100/90 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">
                {line}
              </span>
            </div>
          ))}
          
          {(isTyping || loading) && (
            <div className="flex items-center gap-2 mt-2">
              <span className="h-3 w-2 animate-pulse bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
              <span className="text-[10px] uppercase tracking-widest text-cyan-400/70">Awaiting Response...</span>
            </div>
          )}

          {!loading && visibleLines.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-10 text-slate-500">
              <Terminal className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-[10px] uppercase tracking-[0.2em]">Ready for Investigation</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="flex items-center justify-between border-t border-cyan-400/20 bg-slate-900/30 px-4 py-1.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${loading ? 'animate-pulse bg-cyan-400' : 'bg-slate-600'}`} />
            <span className="text-[8px] uppercase text-slate-400">Core: {loading ? 'Active' : 'Idle'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            <span className="text-[8px] uppercase text-slate-400">Enc: AES-256</span>
          </div>
        </div>
        <div className="text-[8px] uppercase text-cyan-400/50 tabular-nums">
          LOC: 34.0522° N, 118.2437° W
        </div>
      </div>
    </div>
  )
}
