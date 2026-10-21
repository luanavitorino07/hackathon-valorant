import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useIndex, useLeague, useTeam } from '../lib/data'
import { credits, date, num, pct, roundLabel } from '../lib/format'
import { BUY_LABEL, DIFF_LABEL, mapName, SIDE_SHORT } from '../lib/labels'
import { lastTeam } from '../lib/prefs'
import type { Buy, Side } from '../lib/types'
import { TeamSelect } from '../components/TeamSelect'
import { StatCard } from '../components/StatCard'
import { Section } from '../components/Section'
import { SampleBadge } from '../components/SampleBadge'
import { EconTimeline } from '../components/EconTimeline'
import { EmptyState } from '../components/EmptyState'
import { ErrorState, Skeleton } from '../components/Skeleton'
import { useEvidenceDrawer } from '../components/EvidenceDrawer'

const BUYS = ['eco', 'force', 'full'] as const

export default function Economy() {
  const [sp, setSp] = useSearchParams()
  const idx = useIndex()
  const league = useLeague()
  const slug = sp.get('time') ?? lastTeam()
  const team = useTeam(slug)
  const openEv = useEvidenceDrawer()
  const t = team.data
  const matchParam = sp.get('partida')
  const matchIdx = matchParam !== null ? Number(matchParam) : t ? t.matches.length - 1 : 0

  const leagueTable = useMemo(() => {
    const m = new Map<string, { k: number; n: number; mean: number }>()
    league.data?.economy.table.forEach((c) => m.set(`${c.own}|${c.opp}|${c.side}`, c))
    return m
  }, [league.data])

  if (idx.error || league.error) return <ErrorState message={(idx.error ?? league.error)!} />
  if (!idx.data || !league.data) return <Skeleton lines={5} />
  const L = league.data
  const ev = (metric: string, title: string, which: 'yes' | 'no' = 'yes') => () => slug && openEv({ slug, metric, title, side: which })
  const setParam = (k: string, v: string | null) => {
    const n = new URLSearchParams(sp)
    if (v === null) n.delete(k)
    else n.set(k, v)
    setSp(n, { replace: true })
  }

  return (
    <div>
      <header className="pb-6 border-b border-border">
        <div className="eyebrow">Módulo C · auditoria de economia</div>
        <h1 className="mt-2">Economia</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Tipo de compra pela média do valor de equipamento dos 5 jogadores: eco &lt; {credits(L.params.buy.eco_max)}, force de {credits(L.params.buy.eco_max)} a{' '}
          {credits(L.params.buy.full_min - 1)}, full ≥ {credits(L.params.buy.full_min)}. Rounds 1 e 13 são pistol; prorrogação conta como full.
        </p>
        <div className="mt-6 max-w-md">
          <TeamSelect teams={idx.data.teams} value={slug} onChange={(v) => { const n = new URLSearchParams(); n.set('time', v); setSp(n, { replace: true }) }} />
        </div>
      </header>

      {!slug && <div className="mt-8"><EmptyState title="Escolha um time" /></div>}
      {slug && team.loading && <div className="mt-8"><Skeleton lines={4} /></div>}
      {team.error && <div className="mt-8"><EmptyState title="Time não encontrado" /></div>}
      {t && (
        <>
          <Section label="Perfil" title={`Decisões de compra · ${t.name}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Force estando 3+ atrás" stat={t.economy.slices.all.down3.force} onEvidence={ev('all.econ.down3.force', 'Force estando 3 ou mais rounds atrás')} />
              <StatCard label="Eco após perder o pistol" stat={t.economy.slices.all.eco_after_pistol_loss} onEvidence={ev('all.pistol.after_loss.eco', 'Eco após perder o pistol')} />
              <StatCard label="Anti-eco convertido" stat={t.economy.slices.all.antieco_win} hint="Full contra eco adversário." onEvidence={ev('all.econ.antieco_win', 'Anti-ecos vencidos')} />
              <div className="card p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2"><span className="eyebrow">Créditos sobrando em full</span><SampleBadge badge={t.economy.remaining_full.badge} n={t.economy.remaining_full.n} compact /></div>
                <div className="font-display text-5xl tabular">{credits(t.economy.remaining_full.mean)}</div>
                <p className="text-[13px] text-muted">Média por jogador nos rounds de compra completa. Liga: {credits(t.economy.remaining_full.league_mean)}.</p>
              </div>
            </div>
          </Section>

          <Section label="Tipos de compra" title="Quanto compra e quanto converte">
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead><tr><th scope="col">Compra</th><th scope="col">Frequência</th><th scope="col">Liga</th><th scope="col">Vitória no round</th><th scope="col">Amostra</th></tr></thead>
                <tbody>
                  {BUYS.map((b) => {
                    const sh = t.economy.slices.all.share[b]
                    const w = t.economy.slices.all.win_by_buy[b]
                    return (
                      <tr key={b}>
                        <th scope="row" className="text-left">{BUY_LABEL[b]}</th>
                        <td className="tabular">{pct(sh?.raw)} <span className="text-muted">({sh?.k}/{sh?.n})</span></td>
                        <td className="tabular text-muted">{pct(L.economy.share[b])}</td>
                        <td className="tabular">{w ? <>{pct(w.mean)} <span className="text-muted">({w.k}/{w.n}; liga {pct(w.league)})</span></> : '—'}</td>
                        <td>{w && <SampleBadge badge={w.badge} compact />}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section label="Confrontos" title="Compra própria × compra adversária">
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead><tr><th scope="col">{t.name}</th><th scope="col">Adversário</th><th scope="col">Vitória do time</th><th scope="col">Liga (ataque / defesa)</th><th scope="col">Amostra</th></tr></thead>
                <tbody>
                  {t.economy.table.filter((c) => c.own !== 'pistol').map((c) => {
                    const la = leagueTable.get(`${c.own}|${c.opp}|atk`)
                    const ld = leagueTable.get(`${c.own}|${c.opp}|def`)
                    return (
                      <tr key={`${c.own}-${c.opp}`}>
                        <td>{BUY_LABEL[c.own]}</td>
                        <td>{BUY_LABEL[c.opp]}</td>
                        <td className="tabular">{pct(c.mean)} <span className="text-muted">({c.k}/{c.n})</span></td>
                        <td className="tabular text-muted">{la ? `${pct(la.mean)} (n = ${num(la.n)})` : '—'} / {ld ? `${pct(ld.mean)} (n = ${num(ld.n)})` : '—'}</td>
                        <td><SampleBadge badge={c.badge} compact /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section label="Anti-eco" title="Anti-ecos perdidos" actions={t.economy.anti_eco_losses.length > 0 ? <button type="button" className="btn-ghost" onClick={ev('econ.anti_eco_losses', 'Anti-ecos perdidos')}>Ver evidências ({t.economy.anti_eco_losses.length} rounds)</button> : undefined}>
            {t.economy.anti_eco_losses.length === 0 ? (
              <EmptyState title="Nenhum anti-eco perdido">O time venceu todos os rounds em que comprou full contra eco adversário.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead><tr><th scope="col">Partida</th><th scope="col">Round</th><th scope="col">Lado</th><th scope="col">Equip. médio (time × adv.)</th><th scope="col">Como terminou</th><th scope="col">Cerimônia</th></tr></thead>
                  <tbody>
                    {t.economy.anti_eco_losses.map((a) => {
                      const m = t.matches[a.m]
                      return (
                        <tr key={`${a.m}-${a.r}`}>
                          <td><button type="button" className="underline decoration-border-strong underline-offset-2" onClick={() => setParam('partida', String(a.m))}>{date(m.date)} vs {m.opp_name} ({mapName(m.map)})</button></td>
                          <td className="tabular">{roundLabel(a.r)}</td>
                          <td>{SIDE_SHORT[a.side]}</td>
                          <td className="tabular">{credits(a.avg_loadout)} × {credits(a.opp_avg_loadout)}</td>
                          <td>{a.result}</td>
                          <td>{a.thrifty ? <span className="text-alert">Thrifty (vitória econômica do adversário)</span> : <span className="text-muted">—</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <ReviewSection t={t} onSelect={(m) => setParam('partida', String(m))} />

          <Section label="Linha do tempo" title="Economia de uma partida">
            <div className="mb-4 max-w-xl">
              <label className="flex flex-col gap-1">
                <span className="eyebrow">Partida</span>
                <select className="field" value={matchIdx} onChange={(e) => setParam('partida', e.target.value)}>
                  {t.matches.map((m, i) => (
                    <option key={m.match_id} value={i}>{date(m.date)} · {mapName(m.map)} · vs {m.opp_name} · {m.score_for}–{m.score_against}</option>
                  ))}
                </select>
              </label>
            </div>
            {t.economy.timelines[String(matchIdx)] ? (
              <div className="card p-5">
                <EconTimeline rows={t.economy.timelines[String(matchIdx)]} teamName={t.name} oppName={t.matches[matchIdx].opp_name} />
              </div>
            ) : <EmptyState title="Partida sem dados de economia" />}
          </Section>
          <p className="mt-6 text-[13px] text-muted">Os perfis por mapa estão no <Link className="underline" to={`/time/${t.slug}?aba=economia`}>dossiê</Link>.</p>
        </>
      )}
    </div>
  )
}

function ReviewSection({ t, onSelect }: { t: NonNullable<ReturnType<typeof useTeam>['data']>; onSelect: (m: number) => void }) {
  const rows = t.economy.review
  return (
    <Section label="Retorno em 2 rounds" title="Rounds para revisar">
      <p className="-mt-2 mb-4 text-sm text-muted max-w-3xl">
        Para cada decisão, comparamos a média de rounds vencidos no próprio round e no seguinte (mesma metade) em situações parecidas da liga: mesma faixa de placar,
        mesma sequência de derrotas e mesmo lado. Listamos só quando o time perdeu o round, a alternativa mais comum teve retorno claramente maior
        (P &gt; 90%, ≥ 0,2 round de diferença, n ≥ 15 nos dois lados) e os créditos do time permitiam essa alternativa. Vale revisar o contexto no VOD: a decisão pode ter tido motivo que os dados não mostram.
      </p>
      {rows.length === 0 ? (
        <EmptyState title="Nada para revisar">Nenhuma decisão do time ficou claramente abaixo da alternativa mais comum da liga.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr><th scope="col">Partida</th><th scope="col">Round</th><th scope="col">Placar</th><th scope="col">Situação</th><th scope="col">Decisão</th><th scope="col">Alternativa comum</th><th scope="col">Retorno histórico (2 rounds)</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const m = t.matches[r.m]
                return (
                  <tr key={`${r.m}-${r.r}`}>
                    <td><button type="button" className="underline decoration-border-strong underline-offset-2" onClick={() => onSelect(r.m)}>{date(m.date)} vs {m.opp_name}</button> <span className="text-muted">({mapName(m.map)})</span></td>
                    <td className="tabular">{roundLabel(r.r)} · {SIDE_SHORT[r.side as Side]}</td>
                    <td className="tabular">{r.score}</td>
                    <td className="text-muted">{situation(r.diff, r.streak)}</td>
                    <td>{BUY_LABEL[r.buy as Buy]} <span className="text-muted tabular">({credits(r.avg_loadout)}; banco {credits(r.avg_bank)})</span></td>
                    <td>{BUY_LABEL[r.alt as Buy]}</td>
                    <td className="tabular">{num(r.ret_buy, 2)} <span className="text-muted">(n = {num(r.n_buy)})</span> vs {num(r.ret_alt, 2)} <span className="text-muted">(n = {num(r.n_alt)})</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function situation(diff: number, streak: number) {
  const d = diff <= -3 ? DIFF_LABEL['le_-3'] : diff < 0 ? DIFF_LABEL['-2_-1'] : diff === 0 ? DIFF_LABEL['0'] : diff <= 2 ? DIFF_LABEL['1_2'] : DIFF_LABEL.ge_3
  const s = streak === 0 ? 'vindo de vitória' : `${streak >= 3 ? '3+' : streak} ${streak === 1 ? 'derrota seguida' : 'derrotas seguidas'}`
  return `${d}, ${s}`
}
