'use client'
import { useState } from 'react'

export default function SyncButton({
  onSync,
  lastSync,
}: {
  onSync: () => void
  lastSync: string | null
}) {
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    await fetch('/api/sync', { method: 'POST' })
    await onSync()
    setSyncing(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
        style={{
          background: syncing ? 'var(--surface2)' : 'var(--gold)',
          color: syncing ? 'var(--text-dim)' : '#000',
          border: '1px solid transparent',
        }}
      >
        <span className={syncing ? 'animate-spin' : ''}>↻</span>
        {syncing ? 'Syncing...' : 'Sync Data'}
      </button>
      {lastSync && (
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          Last sync: {lastSync}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: '#22c55e' }}
        />
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          Auto-sync every 60 min
        </span>
      </div>
    </div>
  )
}
