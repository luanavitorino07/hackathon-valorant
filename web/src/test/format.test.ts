import { describe, expect, it } from 'vitest'
import { credits, date, mmss, num, pct, pp, roundLabel } from '../lib/format'

describe('formatadores pt-BR', () => {
  it('porcentagem sem casas e com vírgula', () => {
    expect(pct(0.6812)).toBe('68%')
    expect(pct(0.6812, 1)).toBe('68,1%')
    expect(pct(null)).toBe('—')
  })
  it('números com separador pt-BR', () => {
    expect(num(1234.5, 1)).toBe('1.234,5')
    expect(credits(3500)).toBe('3.500')
  })
  it('pontos percentuais com sinal', () => {
    expect(pp(0.032)).toBe('+3,2 p.p.')
    expect(pp(-0.05)).toBe('−5,0 p.p.')
    expect(pp(0)).toBe('0,0 p.p.')
    expect(pp(-0.0004)).toBe('−0,0 p.p.') // negativo continua negativo (não parece cruzar o zero)
  })
  it('tempo m:ss', () => {
    expect(mmss(34)).toBe('0:34')
    expect(mmss(65.4)).toBe('1:05')
    expect(mmss(null)).toBe('—')
  })
  it('datas e rounds', () => {
    expect(date('2026-06-20')).toBe('20/06/2026')
    expect(roundLabel(0)).toBe('R1')
  })
})
