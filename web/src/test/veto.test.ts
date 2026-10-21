import { describe, expect, it } from 'vitest'
import { sideEstimate, vetoRow, vetoTable } from '../lib/veto'
import type { LeagueFile, Prop, TeamFile } from '../lib/types'

const prop = (mean: number, n = 300): Prop => ({ k: Math.round(mean * n), n, alpha: 1, beta: 1, mean, lo: mean - 0.03, hi: mean + 0.03, raw: mean, badge: 'ok' })

const league = {
  params: { veto: { kappa: 12, clamp: [0.05, 0.95] }, sample: { insufficient_below: 5, ok_from: 15 } },
  sides: {
    overall: { atk: { k: 0, n: 0, rate: 0.5 }, def: { k: 0, n: 0, rate: 0.5 } },
    maps: {
      ascent: { matches: 10, atk: { k: 100, n: 200, rate: 0.5 }, def: { k: 100, n: 200, rate: 0.5 } },
      lotus: { matches: 10, atk: { k: 110, n: 200, rate: 0.55 }, def: { k: 90, n: 200, rate: 0.45 } },
    },
  },
} as unknown as LeagueFile

function team(atk: number, def: number, maps: Record<string, [number, number, number, number]>): TeamFile {
  return {
    veto: {
      overall: { atk: prop(atk), def: prop(def) },
      maps: Object.fromEntries(Object.entries(maps).map(([m, [ka, na, kd, nd]]) => [m, { matches: 1, atk: { k: ka, n: na }, def: { k: kd, n: nd } }])),
    },
  } as unknown as TeamFile
}

describe('Veto Advisor', () => {
  it('prior hierárquico: sem rounds no mapa, a estimativa é o prior', () => {
    const t = team(0.6, 0.5, {})
    const e = sideEstimate(t, 'ascent', 'atk', league)
    expect(e.priorMean).toBeCloseTo(0.6, 10) // 0.5 + (0.6 − 0.5)
    expect(e.mean).toBeCloseTo(0.6, 10)
  })
  it('prior limitado a [0,05; 0,95]', () => {
    const t = team(0.99, 0.5, {})
    expect(sideEstimate(t, 'lotus', 'atk', league).priorMean).toBe(0.95)
  })
  it('posterior = (k + κ·prior)/(n + κ)', () => {
    const t = team(0.5, 0.5, { ascent: [30, 40, 20, 40] })
    const e = sideEstimate(t, 'ascent', 'atk', league)
    expect(e.mean).toBeCloseTo((30 + 12 * 0.5) / (40 + 12), 10)
  })
  it('times iguais → vantagem zero e chip neutro', () => {
    const a = team(0.5, 0.5, { ascent: [20, 40, 20, 40] })
    const r = vetoRow(a, a, 'ascent', league)
    expect(r.advantage).toBeCloseTo(0, 10)
    expect(r.chip).toBe('neutral')
    expect(r.lo).toBeLessThan(0)
    expect(r.hi).toBeGreaterThan(0)
  })
  it('time muito superior com amostra grande → escolher; o oposto → banir', () => {
    const strong = team(0.65, 0.65, { ascent: [130, 200, 130, 200] })
    const weak = team(0.35, 0.35, { ascent: [70, 200, 70, 200] })
    expect(vetoRow(strong, weak, 'ascent', league).chip).toBe('pick')
    expect(vetoRow(weak, strong, 'ascent', league).chip).toBe('ban')
  })
  it('poucos rounds → dados insuficientes', () => {
    const a = team(0.5, 0.5, { ascent: [2, 3, 2, 3] })
    const b = team(0.5, 0.5, { ascent: [20, 40, 20, 40] })
    expect(vetoRow(a, b, 'ascent', league).chip).toBe('insufficient')
  })
  it('adversário médio da liga não tem variância e a tabela ordena por vantagem', () => {
    const a = team(0.6, 0.6, { ascent: [60, 100, 60, 100], lotus: [40, 100, 40, 100] })
    const rows = vetoTable(a, null, ['lotus', 'ascent'], league)
    expect(rows[0].map).toBe('ascent')
    expect(rows[0].bAtk.variance).toBe(0)
    expect(Number.isFinite(rows[0].nB)).toBe(false)
  })
})
