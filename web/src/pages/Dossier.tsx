import { lazy, Suspense, useEffect, useMemo, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useIndex, useLeague, useTeam } from '../lib/data'
import { date, mmss, num, pct } from '../lib/format'
import { BUY_LABEL, mapName, PLANT_CLASS_LABEL, SOURCE_SHORT } from '../lib/labels'
import { rememberTeam } from '../lib/prefs'
import { posterior } from '../lib/stats'
import type { InsightCardData, LeagueFile, Prop, TeamFile } from '../lib/types'
import { vetoTable } from '../lib/veto'
import { InsightCard } from '../components/InsightCard'
import { StatCard } from '../components/StatCard'
import { SampleBadge } from '../components/SampleBadge'
import { Section } from '../components/Section'
import { MapSelect } from '../components/MapPicker'
import { SideToggle, type SideFilter } from '../components/SideToggle'
import { EmptyState } from '../components/EmptyState'
import { ErrorState, Skeleton } from '../components/Skeleton'
import { IntervalBar } from '../components/IntervalBar'
import { useEvidenceDrawer } from '../components/EvidenceDrawer'

const PlantTimeHistogram = lazy(() => import('../components/PlantTimeHistogram').then((m) => ({ default: m.PlantTimeHistogram })))

const TABS = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'ataque', label: 'Ataque' },
  { id: 'defesa', label: 'Defesa' },
  { id: 'economia', label: 'Economia' },
  { id: 'jogadores', label: 'Jogadores' },
  { id: 'mapas', label: 'Mapas' },
] as const
type TabId = (typeof TABS)[number]['id']

const INSIGHT_SIDE: Record<string, 'atk' | 'def' | 'both'> = {
  site_pref: 'atk', plant_fast: 'atk', plant_late: 'atk', atk_win: 'atk', postplant: 'atk', plant_rate: 'atk',
  def_win: 'def', no_plant: 'def', retake: 'def', retake_site: 'def',
}

export default function Dossier() {
  const { slug = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const team = useTeam(slug)
  const league = useLeague()
  const idx = useIndex()
  const slice = sp.get('mapa') ?? 'all'
  const side = (sp.get('lado') as SideFilter) ?? 'both'
  const tab = (sp.get('aba') as TabId) ?? 'resumo'

  useEffect(() => {
    if (team.data) rememberTeam(slug)
  }, [team.data, slug])

  const set = (k: string, v: string, def: string) => {
    const next = new URLSearchParams(sp)
    if (v === def) next.delete(k)
    else next.set(k, v)
    setSp(next, { replace: true })
  }

  if (team.error) {
    return (
      <EmptyState title="Time não encontrado">
        Não há dados para “{slug}”. <Link to="/" className="underline">Escolha outro time</Link>.
      </EmptyState>
    )
  }
  if (league.error) return <ErrorState message={league.error} />
  if (!team.data || !league.data || !idx.data) return <Skeleton lines={6} />
  const t = team.data
  const L = league.data
  const s = t.profile[slice] ? slice : 'all'
  const rec = t.record[s]

  return (
    <div>
      <header className="flex flex-col gap-5 pb-6 border-b border-border no-print">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="animate-enter">
            <div className="eyebrow">Dossiê de scouting</div>
            <h1 className="mt-2">{t.name}</h1>
            <p className="mt-3 text-muted tabular">
              {mapName(s)} · {num(rec.matches)} {rec.matches === 1 ? 'partida' : 'partidas'} · {num(rec.wins)} V – {num(rec.matches - rec.wins)} D ·{' '}
              {num(rec.rounds)} rounds ({num(rec.rounds_won)} vencidos)
            </p>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Torneios">
              {t.sources.map((x) => <li key={x} className="border border-border px-2 py-0.5 text-[12px] text-muted">{SOURCE_SHORT(x)}</li>)}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn-ghost" to={`/veto?a=${t.slug}`}>Veto</Link>
            <Link className="btn-ghost" to={`/posplant?time=${t.slug}`}>Pós-plant</Link>
            <Link className="btn-ghost" to={`/economia?time=${t.slug}`}>Economia</Link>
            <button type="button" className="btn-primary" onClick={() => window.print()}><span>Imprimir dossiê</span></button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <MapSelect maps={t.maps} value={s} onChange={(v) => set('mapa', v, 'all')} counts={Object.fromEntries(t.maps.map((m) => [m, t.record[m].matches]))} />
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Lado</span>
            <SideToggle value={side} onChange={(v) => set('lado', v, 'both')} />
          </div>
          {rec.matches < 3 && <p className="text-[13px] text-alert max-w-md">Amostra pequena: {rec.matches} {rec.matches === 1 ? 'partida' : 'partidas'} nesta seleção. Leia os números como indícios, não como tendência.</p>}
        </div>
        <div role="tablist" aria-label="Seções do dossiê" className="flex flex-wrap gap-1 -mb-6 mt-2">
          {TABS.map((x) => (
            <button
              key={x.id}
              role="tab"
              id={`tab-${x.id}`}
              aria-selected={tab === x.id}
              aria-controls={`panel-${x.id}`}
              tabIndex={tab === x.id ? 0 : -1}
              className={`px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.12em] border-b-2 ${tab === x.id ? 'border-brand text-bone' : 'border-transparent text-muted hover:text-bone'}`}
              onClick={() => set('aba', x.id, 'resumo')}
              onKeyDown={(e) => {
                const i = TABS.findIndex((y) => y.id === tab)
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
                  set('aba', n.id, 'resumo')
                  setTimeout(() => document.getElementById(`tab-${n.id}`)?.focus(), 0)
                }
              }}
            >
              {x.label}
            </button>
          ))}
        </div>
      </header>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-8 screen-only" key={`${tab}-${s}`}>
        {tab === 'resumo' && <Summary t={t} L={L} s={s} side={side} />}
        {tab === 'ataque' && <Attack t={t} L={L} s={s} />}
        {tab === 'defesa' && <Defense t={t} s={s} />}
        {tab === 'economia' && <EconomyTab t={t} s={s} side={side} />}
        {tab === 'jogadores' && <Players t={t} s={s} />}
        {tab === 'mapas' && <Maps t={t} />}
      </div>
      <PrintDossier t={t} L={L} pool={idx.data.current_pool.maps} />
    </div>
  )
}

function useEv(t: TeamFile) {
  const open = useEvidenceDrawer()
  return (metric: string, title: string, which: 'yes' | 'no' = 'yes') => () => open({ slug: t.slug, metric, side: which, title })
}

function Grid({ children, cols = 3 }: { children: ReactNode; cols?: number }) {
  const c = cols === 4 ? 'lg:grid-cols-4' : cols === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'
  return <div className={`grid grid-cols-1 md:grid-cols-2 ${c} gap-4`}>{children}</div>
}

function filterInsights(cards: InsightCardData[], side: SideFilter, s: string) {
  return cards
    .filter((c) => side === 'both' || (INSIGHT_SIDE[c.kind] ?? 'both') === 'both' || INSIGHT_SIDE[c.kind] === side)
    .sort((a, b) => Number(b.scope === s) - Number(a.scope === s))
}

function Summary({ t, L, s, side }: { t: TeamFile; L: LeagueFile; s: string; side: SideFilter }) {
  const ev = useEv(t)
  const p = t.profile[s]
  const cards = filterInsights(t.insights, side, s)
  return (
    <div>
      <Section label="Tendências" title="O que os dados sugerem">
        <p className="-mt-2 mb-4 text-sm text-muted max-w-3xl">
          Cartões gerados por regras fixas: só aparecem com n ≥ {L.params.insight.min_n} e quando a diferença para a liga é provável (&gt; {pct(L.params.prob_threshold)})
          ou a participação passa de {num(L.params.insight.share_ratio, 2)}× o esperado. São sugestões com confiança indicada, não previsões.
        </p>
        {cards.length === 0 ? (
          <EmptyState title="Sem tendências claras com os dados atuais">Nenhuma regra disparou para este filtro. Veja as abas de Ataque e Defesa para os números completos.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {cards.map((c, i) => <InsightCard key={c.id} card={c} slug={t.slug} index={i} />)}
          </div>
        )}
      </Section>
      <Section label={`Números-chave · ${mapName(s)}`}>
        <Grid cols={3}>
          {side !== 'def' && <StatCard label="Rounds de ataque vencidos" stat={p.attack.win} color="var(--color-atk)" onEvidence={ev(`${s}.atk.win`, 'Rounds de ataque vencidos')} />}
          {side !== 'def' && <StatCard label="Vitória após plantar" stat={p.attack.postplant_win} color="var(--color-atk)" onEvidence={ev(`${s}.atk.postplant_win`, 'Vitória após plantar')} />}
          {side !== 'atk' && <StatCard label="Rounds de defesa vencidos" stat={p.defense.win} color="var(--color-def)" onEvidence={ev(`${s}.def.win`, 'Rounds de defesa vencidos')} />}
          {side !== 'atk' && <StatCard label="Retakes bem-sucedidos" stat={p.defense.retake} color="var(--color-def)" onEvidence={ev(`${s}.def.retake`, 'Retakes bem-sucedidos')} />}
          <StatCard label="Pistols vencidos" stat={p.pistol.win} onEvidence={ev(`${s}.pistol.win`, 'Pistols vencidos')} />
        </Grid>
      </Section>
    </div>
  )
}

function SiteBars({ sites, onEv }: { sites: Record<string, Prop | null>; onEv: (x: string) => () => void }) {
  const entries = Object.entries(sites).filter(([, v]) => v)
  return (
    <div className="card p-5 flex flex-col gap-4">
      {entries.map(([x, v]) => {
        const post = posterior(v!.k, v!.n, v!.alpha, v!.beta)
        return (
          <div key={x} className="grid grid-cols-[48px_1fr_auto] items-center gap-4">
            <span className="font-display text-4xl">{x}</span>
            <div>
              <div className="flex justify-between text-sm"><span className="tabular">{pct(v!.raw)} dos plants ({v!.k}/{v!.n})</span><span className="text-muted tabular">liga {pct(v!.league)}</span></div>
              <IntervalBar lo={post.lo} hi={post.hi} mean={post.mean} reference={v!.league} color="var(--color-atk)" />
            </div>
            <button type="button" className="btn-ghost" onClick={onEv(x)}>Evidências ({v!.k})</button>
          </div>
        )
      })}
      <p className="text-[13px] text-muted">Barra: estimativa com shrinkage e intervalo de 80%; tracejado = liga.</p>
    </div>
  )
}

function SitesByMap({ t, kind }: { t: TeamFile; kind: 'sites' | 'retake_by_site' | 'opp_sites' }) {
  const rows = t.maps.map((m) => {
    const p = t.profile[m]
    const d = kind === 'sites' ? p.attack.sites : kind === 'opp_sites' ? p.defense.opp_sites : p.defense.retake_by_site
    return { m, d: d ?? {} }
  })
  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full">
        <thead><tr><th scope="col">Mapa</th><th scope="col">A</th><th scope="col">B</th><th scope="col">C</th></tr></thead>
        <tbody>
          {rows.map(({ m, d }) => (
            <tr key={m}>
              <td>{mapName(m)}</td>
              {['A', 'B', 'C'].map((x) => {
                const v = d[x]
                return <td key={x} className="tabular">{v ? <span className="inline-flex items-center gap-2">{pct(v.raw)} <span className="text-muted">({v.k}/{v.n})</span> <SampleBadge badge={v.badge} compact /></span> : <span className="text-faint" aria-label="não se aplica">—</span>}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Attack({ t, L, s }: { t: TeamFile; L: LeagueFile; s: string }) {
  const ev = useEv(t)
  const a = t.profile[s].attack
  const pt = a.plant_time
  const leagueHist = useMemo(() => {
    if (s !== 'all') return L.plant_times[s]?.hist.counts ?? []
    const maps = Object.values(L.plant_times)
    return maps[0].hist.counts.map((_, i) => maps.reduce((acc, m) => acc + (m.hist.counts[i] ?? 0), 0))
  }, [L, s])
  const edges = Object.values(L.plant_times)[0].hist.edges
  return (
    <div>
      <Section label={`Ataque · ${mapName(s)}`}>
        <Grid cols={3}>
          <StatCard label="Rounds de ataque vencidos" stat={a.win} color="var(--color-atk)" onEvidence={ev(`${s}.atk.win`, 'Rounds de ataque vencidos')} />
          <StatCard label="Taxa de plant" stat={a.plant_rate} color="var(--color-atk)" hint="% dos rounds de ataque com a spike plantada." onEvidence={ev(`${s}.atk.plant_rate`, 'Rounds de ataque com plant')} />
          <StatCard label="Vitória após plantar" stat={a.postplant_win} color="var(--color-atk)" onEvidence={ev(`${s}.atk.postplant_win`, 'Rounds vencidos após o plant')} />
        </Grid>
      </Section>
      <Section label="Sites" title="Onde planta">
        {s !== 'all' && a.sites ? (
          <SiteBars sites={a.sites} onEv={(x) => ev(`${s}.atk.site.${x}`, `${mapName(s)}: plants no site ${x}`)} />
        ) : (
          <SitesByMap t={t} kind="sites" />
        )}
      </Section>
      <Section label="Tempo" title="Ritmo do plant">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between"><span className="eyebrow">Mediana do tempo do plant</span><SampleBadge badge={pt.badge} n={pt.n} compact /></div>
            <div className="font-display text-6xl tabular">{mmss(pt.median)}</div>
            <p className="text-sm text-muted">
              IQR {mmss(pt.q1)}–{mmss(pt.q3)}
              {pt.ci_lo !== null && <> · IC 80% da mediana (bootstrap) {mmss(pt.ci_lo)}–{mmss(pt.ci_hi)}</>}
            </p>
            {pt.class && (
              <p className="text-sm">
                Classe: <strong>{PLANT_CLASS_LABEL[pt.class]}</strong>{' '}
                <span className="text-muted">(percentil mediano {pct(pt.median_pct)} na liga, mesmo mapa; terços da liga)</span>
              </p>
            )}
            <p className="text-[13px] text-muted">Tempo contado a partir do fim da fase de compra.</p>
          </div>
          <div className="lg:col-span-2 card p-5">
            <Suspense fallback={<div style={{ height: 260 }} />}>
              <PlantTimeHistogram edges={edges} team={t.plant_hist[s] ?? []} league={leagueHist} teamName={t.name} terciles={s !== 'all' ? L.plant_times[s]?.terciles_s : null} />
            </Suspense>
          </div>
        </div>
      </Section>
    </div>
  )
}

function Defense({ t, s }: { t: TeamFile; s: string }) {
  const ev = useEv(t)
  const d = t.profile[s].defense
  return (
    <div>
      <Section label={`Defesa · ${mapName(s)}`}>
        <Grid cols={3}>
          <StatCard label="Rounds de defesa vencidos" stat={d.win} color="var(--color-def)" onEvidence={ev(`${s}.def.win`, 'Rounds de defesa vencidos')} />
          <StatCard label="Adversário nem plantou" stat={d.no_plant} color="var(--color-def)" hint="% dos rounds de defesa sem plant adversário." onEvidence={ev(`${s}.def.no_plant`, 'Rounds de defesa sem plant adversário')} />
          <StatCard label="Retakes bem-sucedidos" stat={d.retake} color="var(--color-def)" hint="Rounds vencidos quando o adversário plantou." onEvidence={ev(`${s}.def.retake`, 'Retakes bem-sucedidos')} />
        </Grid>
      </Section>
      <Section label="Por site" title="Retake por site atacado">
        {s !== 'all' && d.retake_by_site ? (
          <Grid cols={3}>
            {Object.entries(d.retake_by_site).map(([x, v]) => (
              <StatCard key={x} label={`Site ${x}: defesas bem-sucedidas`} stat={v} color="var(--color-def)" onEvidence={ev(`${s}.def.retake.${x}`, `${mapName(s)}: retakes no site ${x}`)} />
            ))}
          </Grid>
        ) : (
          <SitesByMap t={t} kind="retake_by_site" />
        )}
      </Section>
      <Section label="Pressão adversária" title="Onde os adversários plantam">
        {s !== 'all' && d.opp_sites ? <SiteBars sites={d.opp_sites} onEv={(x) => ev(`${s}.def.opp_site.${x}`, `${mapName(s)}: adversários plantando no ${x}`)} /> : <SitesByMap t={t} kind="opp_sites" />}
      </Section>
    </div>
  )
}

function BuyDist({ title, d, onEv }: { title: string; d: Record<string, Prop | null>; onEv: (b: string) => () => void }) {
  const n = d.eco?.n ?? d.full?.n ?? 0
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between"><span className="eyebrow">{title}</span><SampleBadge badge={(d.eco ?? d.full)?.badge ?? 'insufficient'} n={n} compact /></div>
      {(['eco', 'force', 'full'] as const).map((b) => {
        const v = d[b]
        if (!v) return null
        return (
          <div key={b} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 text-sm">
            <span className="font-semibold">{BUY_LABEL[b]}</span>
            <div className="h-2 bg-surface-strong relative" aria-hidden="true"><div className="absolute inset-y-0 left-0 bg-bone" style={{ width: `${100 * (v.raw ?? 0)}%` }} /></div>
            <button type="button" className="tabular underline decoration-border-strong underline-offset-2" onClick={onEv(b)}>{pct(v.raw)} ({v.k}/{v.n})</button>
          </div>
        )
      })}
      {d.win && <p className="text-[13px] text-muted">Venceu o round seguinte em {pct(d.win.raw)} ({d.win.k}/{d.win.n}).</p>}
    </div>
  )
}

function EconomyTab({ t, s, side }: { t: TeamFile; s: string; side: SideFilter }) {
  const ev = useEv(t)
  const p = t.profile[s].pistol
  const e = t.economy.slices[s]
  return (
    <div>
      <Section label={`Pistol · ${mapName(s)}`}>
        <Grid cols={3}>
          <StatCard label="Pistols vencidos (R1 e R13)" stat={p.win} onEvidence={ev(`${s}.pistol.win`, 'Pistols vencidos')} />
          {side !== 'def' && <StatCard label="Pistol no ataque" stat={p.atk} color="var(--color-atk)" onEvidence={ev(`${s}.pistol.atk.win`, 'Pistols de ataque vencidos')} />}
          {side !== 'atk' && <StatCard label="Pistol na defesa" stat={p.def} color="var(--color-def)" onEvidence={ev(`${s}.pistol.def.win`, 'Pistols de defesa vencidos')} />}
        </Grid>
      </Section>
      <Section label="Round seguinte ao pistol (R2 e R14)" title="Como compra depois do pistol">
        <Grid cols={2}>
          <BuyDist title="Depois de vencer o pistol" d={p.after_win} onEv={(b) => ev(`${s}.pistol.after_win.${b}`, `Compra ${BUY_LABEL[b as 'eco']} após vencer o pistol`)} />
          <BuyDist title="Depois de perder o pistol" d={p.after_loss} onEv={(b) => ev(`${s}.pistol.after_loss.${b}`, `Compra ${BUY_LABEL[b as 'eco']} após perder o pistol`)} />
        </Grid>
      </Section>
      <Section label="Economia" title="Resumo de compras" actions={<Link className="btn-ghost" to={`/economia?time=${t.slug}`}>Auditoria completa</Link>}>
        <Grid cols={3}>
          <StatCard label="Force estando 3+ atrás" stat={e.down3.force} onEvidence={ev(`${s}.econ.down3.force`, 'Force estando 3 ou mais rounds atrás')} />
          <StatCard label="Anti-eco convertido" stat={e.antieco_win} hint="Full contra eco adversário." onEvidence={ev(`${s}.econ.antieco_win`, 'Anti-ecos vencidos')} />
          <StatCard label="Eco após perder o pistol" stat={e.eco_after_pistol_loss} onEvidence={ev(`${s}.pistol.after_loss.eco`, 'Eco após perder o pistol')} />
        </Grid>
      </Section>
    </div>
  )
}

function Players({ t, s }: { t: TeamFile; s: string }) {
  const ev = useEv(t)
  const rows = t.players[s] ?? []
  if (!rows.length) return <EmptyState title="Sem jogadores nesta seleção" />
  const fmtProp = (v: Prop | null) => {
    if (!v) return '—'
    const post = posterior(v.k, v.n, v.alpha, v.beta)
    return `${pct(post.mean, 1)}`
  }
  return (
    <Section label={`Jogadores-chave · ${mapName(s)}`}>
      <p className="-mt-1 mb-4 text-sm text-muted max-w-3xl">
        Apelidos anônimos e estáveis (nunca o ID da conta). FK = autor do primeiro abate do round; FD = primeira morte do round (sem contar spike e auto-abate).
        Porcentagens com shrinkage em direção à média dos jogadores da liga.
      </p>
      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th scope="col">Jogador</th><th scope="col">Partidas</th><th scope="col">Rounds</th><th scope="col">Agentes</th>
              <th scope="col">Abates/round</th><th scope="col">Mortes/round</th><th scope="col">FK</th><th scope="col">FD</th><th scope="col">Clutches</th><th scope="col">Amostra</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.alias}>
                <th scope="row" className="text-left font-semibold">{r.alias}{r.real_name && <span className="block text-[12px] text-alert">{r.real_name}</span>}</th>
                <td className="tabular">{r.matches}</td>
                <td className="tabular">{num(r.rounds)}</td>
                <td className="text-muted">{r.agents.slice(0, 3).map((a) => `${a.agent} (${a.matches})`).join(', ')}</td>
                <td className="tabular">{num(r.kpr, 2)}</td>
                <td className="tabular">{num(r.dpr, 2)}</td>
                <td className="tabular">
                  <button type="button" className="underline decoration-border-strong underline-offset-2" onClick={ev(`${s}.player.fk|${r.alias}`, `${r.alias}: primeiro abate do round`)}>
                    {fmtProp(r.fk)}
                  </button>
                  <span className="text-muted text-[12px]"> ({r.fk?.k ?? 0})</span>
                </td>
                <td className="tabular">
                  <button type="button" className="underline decoration-border-strong underline-offset-2" onClick={ev(`${s}.player.fd|${r.alias}`, `${r.alias}: primeira morte do round`)}>
                    {fmtProp(r.fd)}
                  </button>
                  <span className="text-muted text-[12px]"> ({r.fd?.k ?? 0})</span>
                </td>
                <td className="tabular">{r.clutches}</td>
                <td><SampleBadge badge={r.badge} compact /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function Maps({ t }: { t: TeamFile }) {
  return (
    <Section label="Mapas" title="Registro e composições por mapa">
      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr><th scope="col">Mapa</th><th scope="col">Partidas</th><th scope="col">V–D</th><th scope="col">Ataque</th><th scope="col">Defesa</th><th scope="col">Composição mais usada</th><th scope="col">Vitórias com ela</th><th scope="col">Agentes mais usados</th></tr>
          </thead>
          <tbody>
            {t.maps.map((m) => {
              const r = t.record[m]
              const p = t.profile[m]
              const c = t.comps[m]
              return (
                <tr key={m}>
                  <th scope="row" className="text-left"><Link to={`?mapa=${m}`} className="font-display text-xl tracking-wide hover:text-brand">{mapName(m)}</Link></th>
                  <td className="tabular">{r.matches}</td>
                  <td className="tabular">{r.wins}–{r.matches - r.wins}</td>
                  <td className="tabular">{pct(p.attack.win?.raw)} <span className="text-muted">({p.attack.win?.k}/{p.attack.win?.n})</span></td>
                  <td className="tabular">{pct(p.defense.win?.raw)} <span className="text-muted">({p.defense.win?.k}/{p.defense.win?.n})</span></td>
                  <td>{c ? c.top_comp.agents.join(', ') : '—'}</td>
                  <td className="tabular">{c ? <span className="inline-flex items-center gap-2">{c.top_comp.k}/{c.top_comp.n} <SampleBadge badge={c.top_comp.badge} compact /></span> : '—'}</td>
                  <td className="text-muted">{c ? c.agents.slice(0, 5).map((a) => `${a.agent} ${pct(a.pct)}`).join(' · ') : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[13px] text-muted">Composição = os 5 agentes da partida. "Vitórias com ela" é contado em partidas, por isso a amostra costuma ser pequena.</p>
    </Section>
  )
}

/** Versão de impressão: 1 página A4 paisagem (resumo + 4 insights + mini veto contra a média da liga). */
function PrintDossier({ t, L, pool }: { t: TeamFile; L: LeagueFile; pool: string[] }) {
  const rec = t.record.all
  const p = t.profile.all
  const maps = pool.filter((m) => t.record[m])
  const rows = vetoTable(t, null, maps, L)
  const kpis: [string, Prop | null][] = [
    ['Ataque', p.attack.win], ['Defesa', p.defense.win], ['Pós-plant', p.attack.postplant_win], ['Retake', p.defense.retake], ['Pistol', p.pistol.win],
  ]
  return (
    <div className="print-only text-[13px] leading-snug" style={{ color: '#111' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #111', paddingBottom: 4 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>ScoutRoom · dossiê de scouting</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, lineHeight: 1 }}>{t.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {rec.matches} partidas · {rec.wins} V – {rec.matches - rec.wins} D · {rec.rounds} rounds<br />
          {t.matches.length ? `${date(t.matches[0].date)} a ${date(t.matches[t.matches.length - 1].date)}` : ''}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, margin: '8px 0' }}>
        {kpis.map(([l, v]) => (
          <div key={l} style={{ border: '1px solid #999', padding: 6 }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>{v ? pct(v.mean) : '—'}</div>
            <div>{v ? `80%: ${pct(v.lo)}–${pct(v.hi)} · n = ${v.n} · liga ${pct(v.league)}` : 'sem dados'}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', borderBottom: '1px solid #999', marginBottom: 4 }}>Principais sugestões</div>
          {t.insights.slice(0, 4).map((c) => (
            <div key={c.id} style={{ border: '1px solid #999', padding: 6, marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{c.headline}</div>
              <div>{c.numbers.map((x) => `${x.value} ${x.label}`).join(' · ')} · n = {c.n} · {c.badge === 'ok' ? 'amostra ok' : c.badge === 'low' ? 'confiança baixa' : 'amostra insuficiente'}</div>
            </div>
          ))}
          {t.insights.length === 0 && <div>Sem tendências claras com os dados atuais.</div>}
        </div>
        <div>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', borderBottom: '1px solid #999', marginBottom: 4 }}>Mini veto · contra um adversário médio da liga</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Mapa</th><th style={{ textAlign: 'right' }}>Vantagem</th><th style={{ textAlign: 'right' }}>Intervalo 80%</th><th style={{ textAlign: 'right' }}>n</th><th style={{ textAlign: 'left', paddingLeft: 6 }}>Sugestão</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.map} style={{ borderTop: '1px solid #ccc' }}>
                  <td>{mapName(r.map)}</td>
                  <td style={{ textAlign: 'right' }}>{(r.advantage * 100).toFixed(1).replace('.', ',')} p.p.</td>
                  <td style={{ textAlign: 'right' }}>{(r.lo * 100).toFixed(1).replace('.', ',')} a {(r.hi * 100).toFixed(1).replace('.', ',')}</td>
                  <td style={{ textAlign: 'right' }}>{r.nA}</td>
                  <td style={{ paddingLeft: 6 }}>{r.chip === 'pick' ? 'Escolher' : r.chip === 'ban' ? 'Banir' : r.chip === 'neutral' ? 'Neutro' : 'Dados insuficientes'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 4 }}>Heurística explicável (prior hierárquico, κ = {L.params.veto.kappa} rounds), não previsão de resultado.</div>
        </div>
      </div>
      <div style={{ marginTop: 8, borderTop: '1px solid #999', paddingTop: 4, fontSize: 9 }}>
        Projeto acadêmico independente criado para o Hackathon USP São Carlos. Não é afiliado nem endossado pela Riot Games. VALORANT e Riot Games são marcas de Riot Games, Inc. ·
        Números com shrinkage beta-binomial e intervalo de 80%; selo: n &lt; {L.params.sample.insufficient_below} insuficiente, {L.params.sample.insufficient_below}–{L.params.sample.ok_from - 1} confiança baixa, ≥ {L.params.sample.ok_from} ok.
      </div>
    </div>
  )
}

