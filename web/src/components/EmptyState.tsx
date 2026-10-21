import type { ReactNode } from 'react'

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card p-8 text-center flex flex-col items-center gap-3" role="status">
      <svg aria-hidden="true" width="40" height="40" viewBox="0 0 40 40" className="text-faint">
        <rect x="6" y="6" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
        <path d="M14 20 H26" stroke="currentColor" strokeWidth="2" />
      </svg>
      <h4>{title}</h4>
      {children && <div className="text-muted text-sm max-w-prose">{children}</div>}
    </div>
  )
}
