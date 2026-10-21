import type { InsightCardData } from '../lib/types'
import { num } from '../lib/format'
import { mapName } from '../lib/labels'
import { SampleBadge } from './SampleBadge'
import { useEvidenceDrawer } from './EvidenceDrawer'

const TONE: Record<InsightCardData['tone'], string> = {
  neutral: 'border-l-bone',
  positive: 'border-l-positive',
  alert: 'border-l-alert',
}

export function InsightCard({ card, slug, index = 0 }: { card: InsightCardData; slug: string; index?: number }) {
  const openEvidence = useEvidenceDrawer()
  return (
    <article
      className={`card card-cut border-l-4 ${TONE[card.tone]} p-5 flex flex-col gap-3 animate-enter`}
      style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{card.scope === 'all' ? 'Geral' : mapName(card.scope)}</span>
        <SampleBadge badge={card.badge} n={card.n} compact />
      </div>
      <h4 className="text-[24px] leading-[1.05]">{card.headline}</h4>
      <dl className="grid grid-cols-3 gap-2">
        {card.numbers.map((x) => (
          <div key={x.label} className="flex flex-col">
            <dt className="text-[12px] text-muted leading-tight order-2">{x.label}</dt>
            <dd className="font-display text-3xl tabular order-1">{x.value}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        className="btn-ghost self-start"
        onClick={() =>
          openEvidence({
            slug,
            metric: card.evidence,
            side: card.evidence_side,
            title: card.headline,
            subtitle: `${num(card.evidence_count)} de ${num(card.n)} rounds sustentam esta sugestão.`,
          })
        }
      >
        Ver evidências ({num(card.evidence_count)} rounds)
      </button>
    </article>
  )
}
