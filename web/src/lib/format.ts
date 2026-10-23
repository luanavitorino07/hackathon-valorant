// Formatadores pt-BR (vírgula decimal, tempo em m:ss).

const pctFmt = new Map<number, Intl.NumberFormat>()
const numFmt = new Map<number, Intl.NumberFormat>()

function pf(digits: number) {
  if (!pctFmt.has(digits)) {
    pctFmt.set(digits, new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }))
  }
  return pctFmt.get(digits)!
}

function nf(digits: number) {
  if (!numFmt.has(digits)) {
    numFmt.set(digits, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }))
  }
  return numFmt.get(digits)!
}

/** 0.6812 -> "68%" (sem espaço, como em pt-BR coloquial). */
export function pct(x: number | null | undefined, digits = 0): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  return pf(digits).format(x).replace(/\s/g, '')
}

export function num(x: number | null | undefined, digits = 0): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  return nf(digits).format(x)
}

/** Diferença em pontos percentuais com sinal: 0.032 -> "+3,2 p.p." */
export function pp(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  const v = x * 100
  const s = nf(digits).format(Math.abs(v))
  if (v === 0) return `${nf(digits).format(0)} p.p.`
  return `${v > 0 ? '+' : '−'}${s} p.p.`
}

/** Segundos -> "m:ss". */
export function mmss(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—'
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/** "2026-06-20" -> "20/06/2026" */
export function date(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function credits(x: number | null | undefined): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  return nf(0).format(Math.round(x))
}

/** Round 0-indexado -> rótulo humano "R1". */
export function roundLabel(r: number): string {
  return `R${r + 1}`
}
