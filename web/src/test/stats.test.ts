import { describe, expect, it } from 'vitest'
import { badgeOf, betaCdf, betaQuantile, posterior, probGreater } from '../lib/stats'

describe('Beta no navegador', () => {
  it('cdf em casos conhecidos', () => {
    expect(betaCdf(0.5, 1, 1)).toBeCloseTo(0.5, 10)
    expect(betaCdf(0.5, 2, 2)).toBeCloseTo(0.5, 10)
    expect(betaCdf(0.3, 2, 5)).toBeCloseTo(0.579825, 5)
  })
  it('quantis batem com scipy (valores de referência)', () => {
    // scipy.stats.beta.ppf(0.1, 207.9, 133.3) = 0.5753 (UFMT Turuna, ataque, exportado pelo pipeline)
    expect(betaQuantile(0.1, 200 + 7.9006, 126 + 7.3473)).toBeCloseTo(0.5753, 3)
    expect(betaQuantile(0.9, 200 + 7.9006, 126 + 7.3473)).toBeCloseTo(0.6429, 3)
  })
  it('posterior dentro de [0,1] e monótona em k', () => {
    let prev = -1
    for (let k = 0; k <= 10; k++) {
      const p = posterior(k, 10, 3, 4)
      expect(p.lo).toBeGreaterThanOrEqual(0)
      expect(p.hi).toBeLessThanOrEqual(1)
      expect(p.lo).toBeLessThanOrEqual(p.mean)
      expect(p.mean).toBeLessThanOrEqual(p.hi)
      expect(p.mean).toBeGreaterThan(prev)
      prev = p.mean
    }
  })
  it('selo de amostra', () => {
    expect(badgeOf(4)).toBe('insufficient')
    expect(badgeOf(5)).toBe('low')
    expect(badgeOf(15)).toBe('ok')
  })
  it('P(A > B)', () => {
    expect(probGreater(0.5, 0.01, 0.5, 0.01)).toBeCloseTo(0.5, 6)
    expect(probGreater(0.7, 0.001, 0.5, 0.001)).toBeGreaterThan(0.99)
  })
})
