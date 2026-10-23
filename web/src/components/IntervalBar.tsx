import { pct } from '../lib/format'

interface Props {
  lo: number
  hi: number
  mean: number
  min?: number
  max?: number
  reference?: number | null
  referenceLabel?: string
  color?: string
  height?: number
  format?: (x: number) => string
  className?: string
}

/** Barra de intervalo: faixa de 80% + marca da estimativa (+ referência opcional, ex.: liga). */
export function IntervalBar({ lo, hi, mean, min = 0, max = 1, reference, referenceLabel = 'liga', color = 'var(--color-bone)', height = 14, format = (x) => pct(x), className = '' }: Props) {
  const span = max - min || 1
  const x = (v: number) => `${(100 * (Math.min(max, Math.max(min, v)) - min)) / span}%`
  const label = `Estimativa ${format(mean)}, intervalo de 80% de ${format(lo)} a ${format(hi)}` + (reference != null ? `; ${referenceLabel} ${format(reference)}` : '')
  return (
    <svg role="img" aria-label={label} width="100%" height={height} className={`block overflow-visible ${className}`}>
      <title>{label}</title>
      <line x1="0" x2="100%" y1={height / 2} y2={height / 2} stroke="var(--color-border-strong)" strokeWidth="1" />
      {min < 0 && max > 0 && <line x1={x(0)} x2={x(0)} y1="0" y2={height} stroke="var(--color-muted)" strokeWidth="1" />}
      <rect x={x(lo)} width={`${(100 * (Math.min(hi, max) - Math.max(lo, min))) / span}%`} y={height / 2 - 3} height="6" fill={color} opacity="0.45" />
      {reference != null && (
        <line x1={x(reference)} x2={x(reference)} y1="1" y2={height - 1} stroke="var(--color-muted)" strokeWidth="2" strokeDasharray="2 2" />
      )}
      <rect x={`calc(${x(mean)} - 2px)`} y="0" width="4" height={height} fill={color} />
    </svg>
  )
}
