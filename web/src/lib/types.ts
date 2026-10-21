// Tipos espelhando os JSON gerados pelo pipeline (pipeline/src/scoutroom/export.py).

export type Badge = 'insufficient' | 'low' | 'ok'
export type Side = 'atk' | 'def'
export type Buy = 'pistol' | 'eco' | 'force' | 'full'

export interface Prop {
  id?: string
  k: number
  n: number
  alpha: number
  beta: number
  mean: number
  lo: number
  hi: number
  raw: number | null
  badge: Badge
  league?: number | null
  league_n?: number
  p_gt_league?: number
}

export interface MedianSummary {
  n: number
  badge: Badge
  median: number | null
  q1: number | null
  q3: number | null
  ci_lo: number | null
  ci_hi: number | null
  median_pct?: number | null
  class?: 'fast' | 'medium' | 'late' | null
}

export interface TeamIndexEntry {
  slug: string
  name: string
  matches: number
  wins: number
  rounds: number
  maps: Record<string, number>
  sources: string[]
  last_date: string | null
  insights: number
}

export interface IndexFile {
  generated_at: string
  dataset: {
    matches: number
    rounds: number
    teams: number
    players: number
    plants: number
    kills: number
    first_date: string
    last_date: string
    sources: { source: string; matches: number }[]
    maps: { map: string; name: string; matches: number }[]
  }
  current_pool: { source: string; maps: string[] }
  teams: TeamIndexEntry[]
  real_names: boolean
}

export interface SideRate { k: number; n: number; rate?: number }

export interface ArchetypeStratum {
  label: 'compact' | 'open' | 'lurk'
  stratum: Stratum
  with: Prop | null
  without: Prop | null
  p_with_gt_without: number | null
  probable: boolean
}

export type Stratum = 'le_-1' | 'eq_0' | 'ge_+1'

export interface EconCell extends Prop { own: Buy; opp: Buy; side?: Side }

export interface ReturnRow {
  diff: string
  streak: string
  side: Side
  buy: Buy
  mean: number
  sd: number | null
  n: number
  badge: Badge
}

export interface LeagueFile {
  generated_at: string
  params: {
    sample: { insufficient_below: number; ok_from: number }
    cred_level: number
    prob_threshold: number
    buy: { eco_max: number; full_min: number; pistol_rounds: number[]; regulation_rounds: number }
    veto: { kappa: number; clamp: [number, number] }
    insight: { min_n: number; share_ratio: number; max_cards: number }
    postplant: { aim_tolerance_deg: number; lurk_factor: number; aim_min_dist: number }
    prior_fit: { min_n_per_unit: number; min_strength: number; max_strength: number }
    bootstrap: { resamples: number; min_n: number; seed: number }
    evidence_max: number
  }
  priors: Record<string, { alpha: number; beta: number; league_k: number; league_n: number }>
  sides: {
    overall: Record<Side, SideRate>
    maps: Record<string, { matches: number; atk: SideRate; def: SideRate }>
  }
  plant_times: Record<string, {
    summary: MedianSummary
    terciles_s: [number, number]
    hist: { edges: number[]; counts: number[] }
    by_site: Record<string, MedianSummary>
  }>
  economy: {
    table: EconCell[]
    returns: ReturnRow[]
    share: Record<'eco' | 'force' | 'full', number>
    remaining_full_mean: number
  }
  postplant: {
    archetypes: ArchetypeStratum[]
    label_share: Record<string, number>
    n_plants: number
    atk_win_by_stratum: Record<Stratum, Prop>
  }
}

export interface MatchRef {
  match_id: string
  date: string
  source: string
  map: string
  opp: string
  opp_name: string
  score_for: number
  score_against: number
  won: boolean
  overtime: boolean
  patch: string
  rounds: string // 'W'/'L' por round
  sides: string // 'A'/'D' por round
}

export interface InsightCardData {
  id: string
  kind: string
  headline: string
  numbers: { label: string; value: string }[]
  n: number
  badge: Badge
  stat: Prop
  evidence: string
  evidence_side: 'yes' | 'no'
  evidence_count: number
  scope: string
  strength: number
  tone: 'neutral' | 'positive' | 'alert'
}

export interface SliceProfile {
  attack: {
    win: Prop | null
    plant_rate: Prop | null
    postplant_win: Prop | null
    plant_fast: Prop | null
    plant_late: Prop | null
    plant_time: MedianSummary
    sites?: Record<string, Prop | null>
  }
  defense: {
    win: Prop | null
    no_plant: Prop | null
    retake: Prop | null
    opp_sites?: Record<string, Prop | null>
    retake_by_site?: Record<string, Prop | null>
  }
  pistol: {
    win: Prop | null
    atk: Prop | null
    def: Prop | null
    after_win: Record<'eco' | 'force' | 'full' | 'win', Prop | null>
    after_loss: Record<'eco' | 'force' | 'full' | 'win', Prop | null>
  }
}

export interface PlayerRow {
  alias: string
  real_name?: string | null
  matches: number
  rounds: number
  badge: Badge
  agents: { agent: string; matches: number }[]
  kills: number
  deaths: number
  assists: number
  kpr: number | null
  dpr: number | null
  clutches: number
  fk: Prop | null
  fd: Prop | null
}

export interface CompData {
  matches: number
  agents: { agent: string; role: string; matches: number; pct: number }[]
  top_comp: Prop & { agents: string[] }
  distinct_comps: number
}

export type Point = [number, number, number] // x, y, viewRadians

export interface Plant {
  m: number
  r: number
  map: string
  site: string
  side: Side // papel do time selecionado neste plant
  t: number
  atk_won: boolean
  adv: number
  stratum: Stratum
  labels: ('compact' | 'open' | 'lurk')[]
  def_near: boolean | null
  mean_dist: number | null
  def_dist: number | null
  aim: number | null
  p: [number, number]
  atk: Point[]
  def: Point[]
}

export interface ReviewRound {
  m: number
  r: number
  map: string
  side: Side
  buy: Buy
  alt: Buy
  diff: number
  streak: number
  score: string
  ret_buy: number
  n_buy: number
  ret_alt: number
  n_alt: number
  p_alt_gt: number
  avg_loadout: number
  avg_bank: number
  opp_buy: Buy
}

export interface AntiEcoLoss {
  m: number
  r: number
  map: string
  side: Side
  thrifty: boolean
  avg_loadout: number
  opp_avg_loadout: number
  result: string
}

// [round, loadout time, loadout adversário, compra, compra adv., venceu(1/0), lado, cerimônia]
export type TimelineRow = [number, number, number, Buy, Buy, 0 | 1, Side, string]

export interface EconSlice {
  share: Record<'eco' | 'force' | 'full', Prop | null>
  win_by_buy: Record<'eco' | 'force' | 'full', Prop | null>
  down3: Record<'eco' | 'force' | 'full', Prop | null>
  eco_after_pistol_loss: Prop | null
  antieco_win: Prop | null
  upset_win: Prop | null
}

export interface TeamFile {
  slug: string
  name: string
  generated_at: string
  sources: string[]
  maps: string[]
  record: Record<string, { matches: number; wins: number; rounds: number; rounds_won: number; atk_rounds: number; def_rounds: number }>
  matches: MatchRef[]
  profile: Record<string, SliceProfile>
  plant_hist: Record<string, number[]>
  comps: Record<string, CompData>
  players: Record<string, PlayerRow[]>
  insights: InsightCardData[]
  veto: {
    overall: Record<Side, Prop | null>
    maps: Record<string, { matches: number; atk: SideRate; def: SideRate }>
  }
  postplant: {
    plants: Plant[]
    summary_atk: {
      map: string; site: string; n: number; top_label: string | null; top_label_n: number
      label_counts: Record<string, number>; postplant_win: Prop | null; plant_time: MedianSummary
    }[]
    summary_def: {
      map: string; site: string; n: number; postplant_win: Prop | null
      def_near: number; def_near_n: number; def_dist_median: number | null
    }[]
  }
  economy: {
    slices: Record<string, EconSlice>
    table: (EconCell & { league: number; league_n: number })[]
    remaining_full: { n: number; mean: number | null; sd: number | null; badge: Badge; league_mean: number }
    anti_eco_losses: AntiEcoLoss[]
    review: ReviewRound[]
    timelines: Record<string, TimelineRow[]>
  }
}

export interface EvidenceList {
  yes: [number, number][]
  no: [number, number][]
  yes_total: number
  no_total: number
}

export interface EvidenceFile {
  slug: string
  match_ids: string[]
  metrics: Record<string, EvidenceList>
}

export interface MapFile {
  map: string
  name: string
  bounds: { xmin: number; xmax: number; ymin: number; ymax: number }
  grid: number
  density: number[]
  sites: Record<string, { cx: number; cy: number; n: number; R: number | null; compact_max: number | null; open_min: number | null; def_dist_median: number | null }>
  n_points: number
}
