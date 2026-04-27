import React, { useState } from 'react';
import { X, Copy, Download, Check, FileText } from 'lucide-react';
import { downloadMarkdown } from '../utils/reportGenerator';

export default function ReportModal({ isOpen, onClose, markdown }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-900 shadow-2xl shadow-cyan-500/10 animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Audit Report Preview</h3>
              <p className="text-xs text-slate-400 uppercase tracking-widest">Markdown Output</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-950/50 p-6">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 font-mono text-sm leading-relaxed text-slate-300 selection:bg-cyan-500/30 selection:text-cyan-200">
            <pre className="whitespace-pre-wrap">{markdown}</pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-900/50 px-6 py-4">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-400/50 hover:bg-slate-700 transition-all active:scale-95"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy to Clipboard</span>
              </>
            )}
          </button>
          
          <button
            onClick={() => downloadMarkdown(markdown)}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-all active:scale-95"
          >
            <Download className="h-4 w-4" />
            <span>Download .md</span>
          </button>
        </div>
      </div>
    </div>
  );
}
