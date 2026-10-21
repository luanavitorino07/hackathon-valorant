// Estatística no navegador: posterior Beta (média + intervalo) e selo de amostra.
import type { Badge } from './types'

export const DEFAULT_SAMPLE = { insufficient_below: 5, ok_from: 15 }

export function badgeOf(n: number, t = DEFAULT_SAMPLE): Badge {
  if (n < t.insufficient_below) return 'insufficient'
  if (n < t.ok_from) return 'low'
  return 'ok'
}

function logGamma(x: number): number {
  // Lanczos (g = 7, n = 9)
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  x -= 1
  let a = c[0]
  const t = x + 7.5
  for (let i = 1; i < 9; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300
  const EPS = 3e-14
  const FPMIN = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/** Função de distribuição da Beta(a, b) (beta incompleta regularizada). */
export function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const lbt = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  const bt = Math.exp(lbt)
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a
  return 1 - (bt * betacf(b, a, 1 - x)) / b
}

/** Quantil da Beta(a, b) por bisseção (precisão ~1e-10). */
export function betaQuantile(p: number, a: number, b: number): number {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (betaCdf(mid, a, b) < p) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export interface Posterior { mean: number; lo: number; hi: number; k: number; n: number }

/** Média posterior (k + α)/(n + α + β) e intervalo de credibilidade central. */
export function posterior(k: number, n: number, alpha = 1, beta = 1, level = 0.8): Posterior {
  const a = k + alpha
  const b = n - k + beta
  const q = (1 - level) / 2
  return { mean: a / (a + b), lo: betaQuantile(q, a, b), hi: betaQuantile(1 - q, a, b), k, n }
}

export function normCdf(z: number): number {
  // Abramowitz–Stegun 7.1.26 via erf
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2)
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y)
}

/** P(A > B) por aproximação normal. */
export function probGreater(meanA: number, varA: number, meanB: number, varB: number): number {
  const sd = Math.sqrt(varA + varB)
  if (sd === 0) return meanA === meanB ? 0.5 : meanA > meanB ? 1 : 0
  return normCdf((meanA - meanB) / sd)
}

export function betaVar(k: number, n: number, alpha = 1, beta = 1): number {
  const a = k + alpha
  const b = n - k + beta
  return (a * b) / ((a + b) ** 2 * (a + b + 1))
}
