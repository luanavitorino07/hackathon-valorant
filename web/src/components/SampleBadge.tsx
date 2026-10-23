import type { Badge } from '../lib/types'
import { BADGE_LABEL } from '../lib/labels'

const STYLE: Record<Badge, string> = {
  ok: 'text-positive border-positive/40',
  low: 'text-alert border-alert/40',
  insufficient: 'text-muted border-border-strong',
}

function Icon({ badge }: { badge: Badge }) {
  if (badge === 'ok') {
    return (
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 6.5 L5 9 L10 3" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
    )
  }
  if (badge === 'low') {
    return (
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M6 1.5 L11 10.5 H1 Z" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6 5 V7.5" stroke="currentColor" strokeWidth="1.6" /></svg>
    )
  }
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M3 9 L9 3" stroke="currentColor" strokeWidth="1.6" /></svg>
  )
}

export function SampleBadge({ badge, n, compact = false }: { badge: Badge; n?: number; compact?: boolean }) {
  const label = BADGE_LABEL[badge]
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap ${STYLE[badge]}`}
      title={n !== undefined ? `${label} (n = ${n})` : label}
    >
      <Icon badge={badge} />
      <span>{compact ? (badge === 'ok' ? 'ok' : badge === 'low' ? 'baixa' : 'insuf.') : label}</span>
      {n !== undefined && <span className="tabular text-bone/80 normal-case tracking-normal">n = {n}</span>}
    </span>
  )
}
