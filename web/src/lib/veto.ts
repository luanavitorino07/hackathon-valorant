// Veto Advisor (§7.3): calculado no navegador a partir de teams/*.json e league.json.
import type { LeagueFile, Side, TeamFile } from './types'

export const Z80 = 1.2815515655446004

export type VetoChip = 'pick' | 'ban' | 'neutral' | 'insufficient'

export interface SideEstimate {
  mean: number
  variance: number
  k: number
  n: number
  priorMean: number
}

export interface VetoRow {
  map: string
  aAtk: SideEstimate
  aDef: SideEstimate
  bAtk: SideEstimate
  bDef: SideEstimate
  expAtk: number // expectativa de A ao atacar
  expDef: number // expectativa de A ao defender
  advantage: number // média dos dois lados − 0,5
  lo: number
  hi: number
  nA: number // rounds de A no mapa
  nB: number // rounds de B no mapa
  chip: VetoChip
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

function leagueRate(league: LeagueFile, map: string, side: Side): number {
  return league.sides.maps[map]?.[side]?.rate ?? league.sides.overall[side].rate ?? 0.5
}

/** Taxa de vitória de rounds do time no mapa/lado com prior hierárquico (κ rounds). */
export function sideEstimate(team: TeamFile | null, map: string, side: Side, league: LeagueFile): SideEstimate {
  const lm = leagueRate(league, map, side)
  if (!team) {
    // "Média da liga": adversário médio, sem incerteza de time.
    const n = league.sides.maps[map]?.[side]?.n ?? 0
    return { mean: lm, variance: 0, k: league.sides.maps[map]?.[side]?.k ?? 0, n, priorMean: lm }
  }
  const { kappa, clamp: [cLo, cHi] } = league.params.veto
  const ls = league.sides.overall[side].rate ?? 0.5
  const ts = team.veto.overall[side]?.mean ?? ls
  const priorMean = clamp(lm + (ts - ls), cLo, cHi)
  const kn = team.veto.maps[map]?.[side] ?? { k: 0, n: 0 }
  const mean = (kn.k + kappa * priorMean) / (kn.n + kappa)
  const variance = (mean * (1 - mean)) / (kn.n + kappa + 1)
  return { mean, variance, k: kn.k, n: kn.n, priorMean }
}

export function vetoRow(a: TeamFile, b: TeamFile | null, map: string, league: LeagueFile, minN = 5): VetoRow {
  const aAtk = sideEstimate(a, map, 'atk', league)
  const aDef = sideEstimate(a, map, 'def', league)
  const bAtk = sideEstimate(b, map, 'atk', league)
  const bDef = sideEstimate(b, map, 'def', league)
  const expAtk = (aAtk.mean + (1 - bDef.mean)) / 2
  const expDef = (aDef.mean + (1 - bAtk.mean)) / 2
  const advantage = (expAtk + expDef) / 2 - 0.5
  const varAtk = (aAtk.variance + bDef.variance) / 4
  const varDef = (aDef.variance + bAtk.variance) / 4
  const sd = Math.sqrt((varAtk + varDef) / 4)
  const lo = advantage - Z80 * sd
  const hi = advantage + Z80 * sd
  const nA = aAtk.n + aDef.n
  const nB = b ? bAtk.n + bDef.n : Infinity
  const insufficient = Math.min(aAtk.n, aDef.n) < minN || (b !== null && Math.min(bAtk.n, bDef.n) < minN)
  let chip: VetoChip = 'neutral'
  if (insufficient) chip = 'insufficient'
  else if (advantage > 0 && lo > 0) chip = 'pick'
  else if (advantage < 0 && hi < 0) chip = 'ban'
  return { map, aAtk, aDef, bAtk, bDef, expAtk, expDef, advantage, lo, hi, nA, nB, chip }
}

export function vetoTable(a: TeamFile, b: TeamFile | null, maps: string[], league: LeagueFile): VetoRow[] {
  const minN = league.params.sample.insufficient_below
  return maps.map((m) => vetoRow(a, b, m, league, minN)).sort((x, y) => y.advantage - x.advantage)
}

export const CHIP_LABEL: Record<VetoChip, string> = {
  pick: 'Escolher',
  ban: 'Banir',
  neutral: 'Neutro',
  insufficient: 'Dados insuficientes',
}
