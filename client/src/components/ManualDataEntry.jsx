import React, { useState } from 'react'
import { Plus, Trash2, Save, Loader } from 'lucide-react'
import { uploadManual } from '../api'

export default function ManualDataEntry({ onDataUploaded }) {
  const [rows, setRows] = useState([{ gender: 'male', yhat: 1 }, { gender: 'female', yhat: 0 }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const addRow = () => {
    const newRow = rows.length > 0 ? { ...rows[0] } : { gender: '', yhat: '' }
    Object.keys(newRow).forEach(key => newRow[key] = '')
    setRows([...rows, newRow])
  }

  const removeRow = (index) => {
    setRows(rows.filter((_, i) => i !== index))
  }

  const handleInputChange = (index, field, value) => {
    const newRows = [...rows]
    newRows[index][field] = value
    setRows(newRows)
  }

  const addField = () => {
    const fieldName = prompt('Enter new field name:')
    if (fieldName && !Object.keys(rows[0] || {}).includes(fieldName)) {
      setRows(rows.map(row => ({ ...row, [fieldName]: '' })))
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      // Validate and clean data
      const cleanedData = rows.map(row => {
        const newRow = {}
        Object.entries(row).forEach(([k, v]) => {
          // Try to convert to number if possible
          const num = Number(v)
          newRow[k] = isNaN(num) || v === '' ? v : num
        })
        return newRow
      })

      const result = await uploadManual(cleanedData)
      onDataUploaded?.(result, 'manual_entry.json')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Manual Data Entry</h3>
          <p className="mt-1 text-xs leading-6 text-slate-400">Enter a small table directly when a CSV is not available. The data is sent to the same analysis pipeline.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={addField}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition hover:border-cyan-400/30 hover:bg-slate-800"
          >
            Add Field
          </button>
          <button
            onClick={addRow}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition hover:border-cyan-400/30 hover:bg-slate-800"
          >
            <Plus className="h-3 w-3" /> Add Row
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 shadow-[0_0_28px_rgba(8,15,28,0.3)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              {rows.length > 0 && Object.keys(rows[0]).map(key => (
                <th key={key} className="px-4 py-3 font-medium">{key}</th>
              ))}
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-800/30 transition">
                {Object.keys(row).map(field => (
                  <td key={field} className="px-3 py-2">
                    <input
                      type="text"
                      value={row[field]}
                      onChange={(e) => handleInputChange(rowIndex, field, e.target.value)}
                      className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-slate-200 outline-none transition placeholder-slate-600 focus:border-cyan-400/30 focus:bg-slate-900/60"
                      placeholder={`Enter ${field}...`}
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => removeRow(rowIndex)}
                    className="text-slate-500 hover:text-rose-400 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || rows.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader className="h-4 w-4 animate-spin" />
            Processing Data...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Analyze Manual Data
          </>
        )}
      </button>
    </div>
  )
}
