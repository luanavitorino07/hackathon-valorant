import type { Prop } from '../lib/types'
import { num, pct } from '../lib/format'
import { posterior } from '../lib/stats'
import { IntervalBar } from './IntervalBar'
import { SampleBadge } from './SampleBadge'

interface Props {
  label: string
  stat: Prop | null | undefined
  hint?: string
  color?: string
  onEvidence?: () => void
  evidenceCount?: number
}

/** Valor grande (estimativa com shrinkage) + barra de intervalo + selo. O front recalcula a partir de k, n, α, β. */
export function StatCard({ label, stat, hint, color, onEvidence, evidenceCount }: Props) {
  if (!stat || stat.n === 0) {
    return (
      <div className="card p-4 animate-enter">
        <div className="eyebrow">{label}</div>
        <div className="mt-2 font-display text-4xl text-muted">—</div>
        <p className="mt-2 text-sm text-muted">Sem rounds nesta seleção.</p>
      </div>
    )
  }
  const post = posterior(stat.k, stat.n, stat.alpha, stat.beta)
  const insufficient = stat.badge === 'insufficient'
  return (
    <div className="card p-4 flex flex-col gap-2 animate-enter">
      <div className="flex items-start justify-between gap-2">
        <div className="eyebrow">{label}</div>
        <SampleBadge badge={stat.badge} n={stat.n} compact />
      </div>
      <div className={`font-display text-5xl leading-none tabular ${insufficient ? 'text-muted' : ''}`}>{pct(post.mean)}</div>
      <IntervalBar lo={post.lo} hi={post.hi} mean={post.mean} reference={stat.league ?? null} color={color} />
      <div className="text-[13px] text-muted leading-snug">
        Intervalo de 80%: {pct(post.lo)}–{pct(post.hi)} · observado {pct(stat.raw)} ({num(stat.k)}/{num(stat.n)})
        {stat.league != null && <> · liga {pct(stat.league)}</>}
      </div>
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
      {onEvidence && (
        <button type="button" className="btn-ghost self-start mt-1" onClick={onEvidence}>
          Ver evidências ({num(evidenceCount ?? stat.k)} rounds)
        </button>
      )}
    </div>
  )
}
