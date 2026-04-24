'use client'
import { useState } from 'react'

export default function ReportButton({ id, type }: { id: string; type: 'cat' | 'comment' }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleReport() {
    if (state !== 'idle') return
    setState('loading')
    try {
      const res = await fetch(`/api/${type === 'cat' ? 'cats' : 'comments'}/${id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') return <span className="text-xs text-gray-400">🚩 Reported — thanks</span>
  if (state === 'error') return <span className="text-xs text-red-400">⚠️ Report failed — try again</span>

  return (
    <button
      onClick={handleReport}
      disabled={state === 'loading'}
      className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
    >
      {state === 'loading' ? 'Reporting…' : '🚩 Report this cat'}
    </button>
  )
}
