'use client'
import { useState } from 'react'

export default function ReportButton({ id, type }: { id: string; type: 'cat' | 'comment' }) {
  const [reported, setReported] = useState(false)

  async function handleReport() {
    await fetch(`/api/${type === 'cat' ? 'cats' : 'comments'}/${id}/report`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    setReported(true)
  }

  if (reported) return <span className="text-xs text-gray-400">Reported — thanks</span>
  return (
    <button onClick={handleReport} className="text-xs text-gray-400 hover:text-gray-600">
      🚩 Report this cat
    </button>
  )
}
