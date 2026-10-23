import type { Badge, Buy, Side, Stratum } from './types'

export const MAP_NAMES: Record<string, string> = {
  ascent: 'Ascent', lotus: 'Lotus', haven: 'Haven', split: 'Split', sunset: 'Sunset', abyss: 'Abyss',
  summit: 'Summit', breeze: 'Breeze', pearl: 'Pearl', fracture: 'Fracture', bind: 'Bind', icebox: 'Icebox', corrode: 'Corrode',
}

export const mapName = (m: string) => (m === 'all' ? 'Todos os mapas' : MAP_NAMES[m] ?? m)

export const BUY_LABEL: Record<Buy, string> = { pistol: 'Pistol', eco: 'Eco', force: 'Force', full: 'Full' }
export const BUY_LONG: Record<Buy, string> = {
  pistol: 'Pistol', eco: 'Eco (economia)', force: 'Force (compra parcial)', full: 'Full (compra completa)',
}

export const SIDE_LABEL: Record<Side, string> = { atk: 'Ataque', def: 'Defesa' }
export const SIDE_SHORT: Record<Side, string> = { atk: 'ATK', def: 'DEF' }

export const BADGE_LABEL: Record<Badge, string> = {
  insufficient: 'Amostra insuficiente',
  low: 'Confiança baixa',
  ok: 'Amostra ok',
}

export const ARCHETYPE_LABEL: Record<string, string> = {
  compact: 'Compacto no spike',
  open: 'Aberto',
  lurk: 'Fora do BOMB / lurk',
}

export const ARCHETYPE_HELP: Record<string, string> = {
  compact: 'Distância média dos atacantes vivos ao spike no terço mais baixo da liga (mesmo mapa e BOMB).',
  open: 'Dispersão das distâncias dos atacantes no terço mais alto da liga (exige 2+ atacantes vivos).',
  lurk: 'Pelo menos 1 atacante vivo a mais de 2R do spike (R = distância mediana da liga), ignorando prováveis AFKs.',
}

export const STRATUM_LABEL: Record<Stratum, string> = {
  'le_-1': 'Ataque em desvantagem (≤ −1)',
  eq_0: 'Números iguais (0)',
  'ge_+1': 'Ataque em vantagem (≥ +1)',
}

export const DIFF_LABEL: Record<string, string> = {
  'le_-3': 'perdendo por 3+', '-2_-1': 'perdendo por 1–2', '0': 'empatado', '1_2': 'vencendo por 1–2', ge_3: 'vencendo por 3+',
}

export const PLANT_CLASS_LABEL: Record<string, string> = { fast: 'Rápido', medium: 'Médio', late: 'Tardio' }

export const SOURCE_SHORT = (s: string) => s.replace('Univavá / ', 'Univavá · ')
