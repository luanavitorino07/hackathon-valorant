import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useIndex, useLeague, useMapFile, useTeam } from '../lib/data'
import { date, mmss, num, pct, roundLabel } from '../lib/format'
import { ARCHETYPE_HELP, ARCHETYPE_LABEL, mapName, STRATUM_LABEL } from '../lib/labels'
import { lastTeam } from '../lib/prefs'
import { badgeOf, posterior } from '../lib/stats'
import type { Plant, Stratum } from '../lib/types'
import { TeamSelect } from '../components/TeamSelect'
import { FormationMap } from '../components/FormationMap'
import { IntervalBar } from '../components/IntervalBar'
import { SampleBadge } from '../components/SampleBadge'
import { Section } from '../components/Section'
import { EmptyState } from '../components/EmptyState'
import { ErrorState, Skeleton } from '../components/Skeleton'

const LABELS = ['compact', 'open', 'lurk'] as const
const STRATA: Stratum[] = ['le_-1', 'eq_0', 'ge_+1']
const NO_PLANTS: Plant[] = []

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      <select className="field min-w-36" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

export default function PostPlant() {
  const [sp, setSp] = useSearchParams()
  const idx = useIndex()
  const league = useLeague()
  const slug = sp.get('time') ?? lastTeam()
  const team = useTeam(slug)
  const [selected, setSelected] = useState<Plant | null>(null)
  const [zoom, setZoom] = useState<'site' | 'map'>('site')

  const role = (sp.get('papel') ?? 'atk') as 'atk' | 'def'
  const result = sp.get('resultado') ?? 'todos'
  const site = sp.get('site') ?? 'all'
  const archetype = sp.get('arquetipo') ?? 'todos'

  const plantsAll = team.data?.postplant.plants ?? NO_PLANTS
  const mapsWithPlants = useMemo(() => {
    const c = new Map<string, number>()
    plantsAll.forEach((p) => p.side === role && c.set(p.map, (c.get(p.map) ?? 0) + 1))
    return [...c.entries()].sort((a, b) => b[1] - a[1])
  }, [plantsAll, role])
  const mapa = sp.get('mapa') ?? mapsWithPlants[0]?.[0] ?? null
  const mapFile = useMapFile(mapa)

  const update = (k: string, v: string | null) => {
    const next = new URLSearchParams(sp)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k !== 'site' && k === 'mapa') next.delete('site')
    setSp(next, { replace: true })
    setSelected(null)
  }

  const filtered = useMemo(
    () =>
      plantsAll.filter(
        (p) =>
          p.side === role &&
          p.map === mapa &&
          (site === 'all' || p.site === site) &&
          (result === 'todos' || (result === 'atk' ? p.atk_won : !p.atk_won)) &&
          (archetype === 'todos' || (archetype === 'none' ? p.labels.length === 0 : p.labels.includes(archetype as 'lurk'))),
      ),
    [plantsAll, role, mapa, site, result, archetype],
  )

  if (idx.error || league.error) return <ErrorState message={(idx.error ?? league.error)!} />
  if (!idx.data || !league.data) return <Skeleton lines={5} />
  const t = team.data
  const sites = mapFile.data ? Object.keys(mapFile.data.sites).sort() : []
  const matches = t?.matches ?? []

  // Arquétipos dentro do filtro atual (front recalcula posterior com prior uniforme).
  const base = filtered.filter((p) => p.atk.length > 0)
  const archStats = LABELS.map((lab) => {
    const w = base.filter((p) => p.labels.includes(lab))
    const k = w.filter((p) => p.atk_won).length
    return { lab, n: w.length, k, share: base.length ? w.length / base.length : 0, post: posterior(k, w.length) }
  })

  return (
    <div>
      <header className="pb-6 border-b border-border">
        <div className="eyebrow">Módulo B · playbook de pós-plant</div>
        <h1 className="mt-2">Pós-plant</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Posições de todos os jogadores vivos no instante em que a spike foi plantada, separadas entre atacantes e defensores pelo time de cada um.
          Os rótulos de formação são regras simples comparadas à liga no mesmo mapa e site. <strong className="text-bone">Análise exploratória.</strong>
        </p>
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <TeamSelect teams={idx.data.teams} value={slug} onChange={(v) => { const n = new URLSearchParams(); n.set('time', v); setSp(n, { replace: true }); setSelected(null) }} />
          <Select label="O time está" value={role} onChange={(v) => update('papel', v === 'atk' ? null : v)} options={[['atk', 'Atacando (plants do time)'], ['def', 'Defendendo (plants adversários)']]} />
          {mapsWithPlants.length > 0 && (
            <Select label="Mapa" value={mapa ?? ''} onChange={(v) => update('mapa', v)} options={mapsWithPlants.map(([m, n]) => [m, `${mapName(m)} (${n})`])} />
          )}
          <Select label="Site" value={site} onChange={(v) => update('site', v === 'all' ? null : v)} options={[['all', 'Todos'], ...sites.map((x) => [x, `Site ${x}`] as [string, string])]} />
          <Select label="Resultado" value={result} onChange={(v) => update('resultado', v === 'todos' ? null : v)} options={[['todos', 'Todos'], ['atk', 'Ataque venceu'], ['def', 'Defesa venceu']]} />
          <Select label="Formação" value={archetype} onChange={(v) => update('arquetipo', v === 'todos' ? null : v)} options={[['todos', 'Todas'], ...LABELS.map((l) => [l, ARCHETYPE_LABEL[l]] as [string, string]), ['none', 'Sem rótulo']]} />
        </div>
      </header>

      {!slug && <div className="mt-8"><EmptyState title="Escolha um time">Selecione um time para ver as formações no plant.</EmptyState></div>}
      {slug && team.loading && <div className="mt-8"><Skeleton lines={4} /></div>}
      {team.error && <div className="mt-8"><EmptyState title="Time não encontrado" /></div>}
      {t && mapsWithPlants.length === 0 && <div className="mt-8"><EmptyState title="Sem plants nesta seleção">Este time não tem rounds com spike plantada neste papel.</EmptyState></div>}

      {t && mapa && mapsWithPlants.length > 0 && (
        <div className="grid grid-cols-12 gap-6 mt-8">
          <div className="col-span-12 xl:col-span-7">
            <div className="flex items-center justify-between mb-3">
              <div className="font-display text-3xl tabular" aria-live="polite">{num(filtered.length)} plants</div>
              <div role="group" aria-label="Enquadramento" className="inline-flex">
                <button type="button" className="btn-ghost" aria-pressed={zoom === 'site'} onClick={() => setZoom('site')} disabled={site === 'all'}>Site</button>
                <button type="button" className="btn-ghost -ml-px" aria-pressed={zoom === 'map' || site === 'all'} onClick={() => setZoom('map')}>Mapa inteiro</button>
              </div>
            </div>
            {filtered.length === 0 ? (
              <EmptyState title="Nenhum plant com esses filtros" />
            ) : (
              <FormationMap map={mapFile.data} plants={filtered} site={site} selected={selected} zoom={site === 'all' ? 'map' : zoom} />
            )}
            {selected && (
              <div className="mt-3 card p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>
                  Destaque: {date(matches[selected.m]?.date)} vs {matches[selected.m]?.opp_name} · {roundLabel(selected.r)} · site {selected.site} · plant em {mmss(selected.t)} ·{' '}
                  {selected.atk.length}v{selected.def.length} · {selected.atk_won ? 'ataque venceu' : 'defesa venceu'}
                </span>
                <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>Mostrar todos</button>
              </div>
            )}
          </div>

          <aside className="col-span-12 xl:col-span-5 flex flex-col gap-4" aria-label="Arquétipos">
            <div className="card p-5">
              <div className="eyebrow mb-3">Formações neste filtro · vitória do ataque</div>
              <ul className="flex flex-col gap-4">
                {archStats.map((a) => (
                  <li key={a.lab}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{ARCHETYPE_LABEL[a.lab]}</span>
                      <SampleBadge badge={badgeOf(a.n)} n={a.n} compact />
                    </div>
                    <p className="text-[12px] text-muted">{ARCHETYPE_HELP[a.lab]}</p>
                    <div className="mt-1 grid grid-cols-[1fr_auto] items-center gap-3">
                      <IntervalBar lo={a.post.lo} hi={a.post.hi} mean={a.post.mean} color="var(--color-atk)" />
                      <span className="tabular text-sm whitespace-nowrap">{a.n ? `${pct(a.post.mean)} (${a.k}/${a.n})` : '—'}</span>
                    </div>
                    <p className="text-[12px] text-muted tabular">Presente em {pct(a.share)} dos plants filtrados</p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12px] text-muted">Um plant pode ter mais de um rótulo. Taxas com prior uniforme e intervalo de 80%. Formação e resultado podem andar juntos sem que uma cause a outra.</p>
            </div>
            <SiteSummary t={t} role={role} mapa={mapa} />
          </aside>

          <div className="col-span-12">
            <LeagueStrata league={league.data} />
          </div>

          <div className="col-span-12">
            <Section label="Lista" title="Plants">
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto border border-border">
                <table className="data-table w-full">
                  <thead className="sticky top-0 bg-bg">
                    <tr><th scope="col">Data</th><th scope="col">Adversário</th><th scope="col">Round</th><th scope="col">Site</th><th scope="col">Tempo</th><th scope="col">Vivos (ATK×DEF)</th><th scope="col">Formação</th><th scope="col">Defesa</th><th scope="col">Resultado</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const m = matches[p.m]
                      const sel = selected === p
                      return (
                        <tr key={`${p.m}-${p.r}`} className={sel ? 'bg-brand-tint' : ''}>
                          <td className="tabular">
                            <button type="button" className="underline decoration-border-strong underline-offset-2" aria-pressed={sel} onClick={() => setSelected(sel ? null : p)}>{date(m?.date)}</button>
                          </td>
                          <td>{m?.opp_name}</td>
                          <td className="tabular">{roundLabel(p.r)}</td>
                          <td>{p.site}</td>
                          <td className="tabular">{mmss(p.t)}</td>
                          <td className="tabular">{p.atk.length}×{p.def.length} <span className="text-muted">({p.adv > 0 ? '+' : ''}{p.adv})</span></td>
                          <td>{p.labels.length ? p.labels.map((l) => ARCHETYPE_LABEL[l]).join(', ') : <span className="text-muted">sem rótulo</span>}</td>
                          <td className="text-muted">{p.def_near === null ? '—' : p.def_near ? 'perto do site' : 'longe do site'}</td>
                          <td className={p.atk_won ? 'text-atk' : 'text-def'}>{p.atk_won ? 'Ataque venceu' : 'Defesa venceu'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        </div>
      )}
      {t && <p className="mt-6 text-[13px] text-muted">Ver também: <Link className="underline" to={`/time/${t.slug}?aba=ataque`}>sites e ritmo do plant no dossiê</Link>.</p>}
    </div>
  )
}

function SiteSummary({ t, role, mapa }: { t: NonNullable<ReturnType<typeof useTeam>['data']>; role: 'atk' | 'def'; mapa: string }) {
  if (role === 'atk') {
    const rows = t.postplant.summary_atk.filter((r) => r.map === mapa)
    return (
      <div className="card p-5">
        <div className="eyebrow mb-3">Resumo por site · {t.name} atacando</div>
        <div className="overflow-x-auto"><table className="data-table w-full">
          <thead><tr><th scope="col">Site</th><th scope="col">Plants</th><th scope="col">Formação + comum</th><th scope="col">Vitória</th><th scope="col">Tempo</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.site}>
                <td className="font-display text-xl">{r.site}</td>
                <td className="tabular">{r.n}</td>
                <td>{r.top_label ? `${ARCHETYPE_LABEL[r.top_label]} (${r.top_label_n})` : '—'}</td>
                <td className="tabular">{r.postplant_win ? <>{pct(r.postplant_win.mean)} <span className="text-muted">({r.postplant_win.k}/{r.postplant_win.n})</span></> : '—'}</td>
                <td className="tabular">{mmss(r.plant_time.median)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <p className="mt-2 text-[12px] text-muted">Vitória pós-plant com shrinkage em direção à liga no mesmo site.</p>
      </div>
    )
  }
  const rows = t.postplant.summary_def.filter((r) => r.map === mapa)
  return (
    <div className="card p-5">
      <div className="eyebrow mb-3">Resumo por site · {t.name} defendendo</div>
      <table className="data-table w-full">
        <thead><tr><th scope="col">Site</th><th scope="col">Plants adv.</th><th scope="col">Defesa perto do site</th><th scope="col">Retake vencido</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.site}>
              <td className="font-display text-xl">{r.site}</td>
              <td className="tabular">{r.n}</td>
              <td className="tabular">{r.def_near_n ? `${pct(r.def_near / r.def_near_n)} (${r.def_near}/${r.def_near_n})` : '—'}</td>
              <td className="tabular">{r.postplant_win ? <>{pct(r.postplant_win.mean)} <span className="text-muted">({r.postplant_win.k}/{r.postplant_win.n})</span></> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-muted">“Perto” = distância média dos defensores vivos ao spike abaixo da mediana da liga naquele site.</p>
    </div>
  )
}

function LeagueStrata({ league }: { league: NonNullable<ReturnType<typeof useLeague>['data']> }) {
  const arch = league.postplant.archetypes
  const anyProbable = arch.some((a) => a.probable)
  return (
    <Section label="Liga inteira · exploratório" title="Formação × resultado, por vantagem numérica">
      <p className="-mt-2 mb-4 text-sm text-muted max-w-3xl">
        Para não confundir formação com número de jogadores vivos, a comparação é feita dentro de cada estrato (atacantes vivos − defensores vivos).
        {anyProbable ? ' “Diferença provável” = P > 90% de que a taxa com o rótulo seja diferente da taxa sem ele.' : ' Nenhuma diferença provável (> 90%) com os dados atuais.'}
        {' '}{num(league.postplant.n_plants)} plants na liga.
      </p>
      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr><th scope="col">Formação</th>{STRATA.map((s) => <th key={s} scope="col">{STRATUM_LABEL[s]}</th>)}</tr>
          </thead>
          <tbody>
            {LABELS.map((lab) => (
              <tr key={lab}>
                <th scope="row" className="text-left">{ARCHETYPE_LABEL[lab]}</th>
                {STRATA.map((st) => {
                  const a = arch.find((x) => x.label === lab && x.stratum === st)
                  if (!a?.with || !a.without) return <td key={st}>—</td>
                  return (
                    <td key={st} className="tabular">
                      <div>com: <strong>{pct(a.with.mean)}</strong> <span className="text-muted">(n = {num(a.with.n)})</span></div>
                      <div>sem: {pct(a.without.mean)} <span className="text-muted">(n = {num(a.without.n)})</span></div>
                      <div className={`text-[12px] ${a.probable ? 'text-alert' : 'text-muted'}`}>
                        {a.probable ? `Diferença provável (P = ${pct(a.p_with_gt_without! > 0.5 ? a.p_with_gt_without! : 1 - a.p_with_gt_without!)})` : 'sem diferença provável'}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
