import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useIndex, useLeague, useTeam } from '../lib/data'
import { num, pct, pp } from '../lib/format'
import { mapName } from '../lib/labels'
import { lastTeam } from '../lib/prefs'
import { vetoTable } from '../lib/veto'
import { LEAGUE_OPTION, TeamSelect } from '../components/TeamSelect'
import { MapPicker } from '../components/MapPicker'
import { VetoTable, VetoChipView } from '../components/VetoTable'
import { Section } from '../components/Section'
import { EmptyState } from '../components/EmptyState'
import { ErrorState, Skeleton } from '../components/Skeleton'

export default function Veto() {
  const [sp, setSp] = useSearchParams()
  const idx = useIndex()
  const league = useLeague()
  const a = sp.get('a') ?? lastTeam()
  const b = sp.get('b') ?? LEAGUE_OPTION
  const teamA = useTeam(a)
  const teamB = useTeam(b !== LEAGUE_OPTION ? b : null)

  const pool = idx.data?.current_pool.maps
  const mapsParam = sp.get('mapas')
  const maps = useMemo(() => (mapsParam ? mapsParam.split(',').filter(Boolean) : pool ?? []), [mapsParam, pool])

  const update = (k: string, v: string | null) => {
    const next = new URLSearchParams(sp)
    if (v) next.set(k, v)
    else next.delete(k)
    setSp(next, { replace: true })
  }

  const rows = useMemo(() => {
    if (!teamA.data || !league.data || (b !== LEAGUE_OPTION && !teamB.data)) return null
    return vetoTable(teamA.data, b === LEAGUE_OPTION ? null : teamB.data, maps, league.data)
  }, [teamA.data, teamB.data, league.data, maps, b])

  if (idx.error || league.error) return <ErrorState message={(idx.error ?? league.error)!} />
  if (!idx.data || !league.data) return <Skeleton lines={5} />
  const allMaps = idx.data.dataset.maps.map((m) => m.map)
  const counts = Object.fromEntries(idx.data.dataset.maps.map((m) => [m.map, m.matches]))
  const aName = teamA.data?.name ?? 'Time A'
  const bName = b === LEAGUE_OPTION ? 'adversário médio' : teamB.data?.name ?? 'Time B'
  const kappa = league.data.params.veto.kappa

  return (
    <div>
      <header className="pb-6 border-b border-border">
        <div className="eyebrow">Módulo A · conselheiro de veto</div>
        <h1 className="mt-2">Veto de mapas</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Compara a taxa de rounds vencidos de cada time por mapa e lado, puxada em direção ao esperado quando a amostra é pequena.
          <strong className="text-bone"> É uma heurística explicável, não uma previsão de resultado.</strong>
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
          <TeamSelect teams={idx.data.teams} value={a} onChange={(v) => update('a', v)} label="Nós (time A)" exclude={b} />
          <TeamSelect teams={idx.data.teams} value={b} onChange={(v) => update('b', v === LEAGUE_OPTION ? null : v)} label="Adversário (time B)" includeLeague exclude={a} />
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <span className="eyebrow">Mapas no veto (padrão: pool da fase mais recente, {idx.data.current_pool.source})</span>
          <MapPicker maps={allMaps} selected={maps} onChange={(v) => update('mapas', v.join(','))} counts={counts} />
        </div>
      </header>

      {!a && <div className="mt-8"><EmptyState title="Escolha o time A">Selecione o seu time para comparar mapa a mapa.</EmptyState></div>}
      {a && (teamA.loading || (b !== LEAGUE_OPTION && teamB.loading)) && <div className="mt-8"><Skeleton lines={4} /></div>}
      {rows && rows.length === 0 && <div className="mt-8"><EmptyState title="Nenhum mapa selecionado">Marque ao menos um mapa acima.</EmptyState></div>}
      {rows && rows.length > 0 && teamA.data && (
        <>
          <Section label="Resultado" title={`${aName} × ${bName}`}>
            <div className="mb-4 flex flex-wrap gap-3">
              {(['pick', 'ban'] as const).map((c) => {
                const ms = rows.filter((r) => r.chip === c)
                return (
                  <div key={c} className="card px-4 py-3 flex items-center gap-3">
                    <VetoChipView chip={c} />
                    <span className="text-sm">{ms.length ? ms.map((r) => mapName(r.map)).join(', ') : <span className="text-muted">nenhum mapa com intervalo fora do zero</span>}</span>
                  </div>
                )
              })}
            </div>
            <div className="card p-2">
              <VetoTable rows={rows} aName={aName} bName={bName} />
            </div>
          </Section>
          <Section label="Como ler" title="Legenda">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm text-muted">
              <div className="card p-5">
                <h4 className="text-bone mb-2">Expectativas</h4>
                <p><strong className="text-bone">{aName} atacando</strong> = média entre a taxa de ataque de A e (1 − taxa de defesa de B) naquele mapa. Defendendo é o simétrico.</p>
                <p className="mt-2"><strong className="text-bone">Vantagem</strong> = média dos dois lados − 50%, em pontos percentuais de rounds. Ex.: +5 p.p. ≈ 55% dos rounds.</p>
              </div>
              <div className="card p-5">
                <h4 className="text-bone mb-2">Amostra pequena</h4>
                <p>Cada taxa parte de um prior: a taxa da liga no mapa/lado ajustada pelo desempenho geral do time naquele lado, com peso de κ = {kappa} rounds.
                  Com poucos rounds, o número fica perto desse esperado; com muitos, prevalece o observado.</p>
                <p className="mt-2">n = rounds de A / rounds de B no mapa.</p>
              </div>
              <div className="card p-5">
                <h4 className="text-bone mb-2">Sugestão</h4>
                <ul className="flex flex-col gap-2">
                  <li className="flex items-center gap-2"><VetoChipView chip="pick" /> vantagem &gt; 0 e intervalo de 80% sem cruzar o zero</li>
                  <li className="flex items-center gap-2"><VetoChipView chip="ban" /> vantagem &lt; 0 e intervalo sem cruzar o zero</li>
                  <li className="flex items-center gap-2"><VetoChipView chip="neutral" /> intervalo cruza o zero</li>
                  <li className="flex items-center gap-2"><VetoChipView chip="insufficient" /> menos de {league.data.params.sample.insufficient_below} rounds em algum lado</li>
                </ul>
              </div>
            </div>
          </Section>
          <Section label="Detalhe" title="Taxas por lado usadas no cálculo">
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr><th scope="col">Mapa</th><th scope="col">A ataque</th><th scope="col">A defesa</th><th scope="col">B ataque</th><th scope="col">B defesa</th><th scope="col">Vantagem</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.map}>
                      <th scope="row" className="text-left">{mapName(r.map)}</th>
                      {[r.aAtk, r.aDef, r.bAtk, r.bDef].map((e, i) => (
                        <td key={i} className="tabular">
                          {pct(e.mean, 1)} <span className="text-muted">({num(e.k)}/{num(e.n)}; prior {pct(e.priorMean)})</span>
                        </td>
                      ))}
                      <td className="tabular">{pp(r.advantage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {b === LEAGUE_OPTION && <p className="mt-2 text-[13px] text-muted">Adversário médio = taxas da liga no mapa (todas as partidas), sem incerteza de time.</p>}
            <p className="mt-2 text-[13px] text-muted">Quer ver como {aName} ataca cada mapa? <Link className="underline" to={`/time/${a}?aba=mapas`}>Abrir dossiê</Link>.</p>
          </Section>
        </>
      )}
    </div>
  )
}
