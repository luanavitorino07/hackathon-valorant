import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIndex } from '../lib/data'
import { date, num } from '../lib/format'
import { mapName, SOURCE_SHORT } from '../lib/labels'
import { lastTeam } from '../lib/prefs'
import { TeamSelect } from '../components/TeamSelect'
import { ErrorState, Skeleton } from '../components/Skeleton'

const MODULES = [
  {
    tag: 'Módulo A',
    title: 'Dossiê + Veto',
    text: 'Como o adversário ataca e defende, pistols, composições e jogadores-chave. O conselheiro de veto compara dois times mapa a mapa.',
  },
  {
    tag: 'Módulo B',
    title: 'Pós-plant',
    text: 'Onde cada jogador estava no instante do plant: formações (compacta, aberta, lurk) e quanto cada uma converteu, separando por vantagem numérica.',
  },
  {
    tag: 'Módulo C',
    title: 'Economia',
    text: 'Tipos de compra, anti-ecos, force quando está atrás no placar e rounds que vale revisar, comparados ao retorno histórico da liga.',
  },
]

export function Home() {
  const idx = useIndex()
  const nav = useNavigate()
  const [team, setTeam] = useState<string | null>(lastTeam())

  if (idx.error) return <ErrorState message={idx.error} />
  if (!idx.data) return <Skeleton lines={5} />
  const d = idx.data.dataset
  const valid = team && idx.data.teams.some((t) => t.slug === team) ? team : null

  return (
    <div className="flex flex-col gap-12">
      <section className="grid grid-cols-12 gap-8 items-end pt-6">
        <div className="col-span-12 lg:col-span-7 animate-enter">
          <div className="eyebrow mb-4">Circuito universitário brasileiro · {num(d.matches)} partidas analisadas</div>
          <h1>Prepare-se para o próximo adversário</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Escolha um time e receba, em poucos cliques, um dossiê de scouting com sugestão de veto, o playbook de pós-plant e uma auditoria de economia.
            Todo número mostra o tamanho da amostra, a confiança e os rounds que o sustentam.
          </p>
        </div>
        <div className="col-span-12 lg:col-span-5 card card-cut p-6 flex flex-col gap-5 animate-enter">
          <TeamSelect teams={idx.data.teams} value={valid} onChange={setTeam} label="Escolha o time" large />
          <button type="button" className="btn-primary self-start" disabled={!valid} onClick={() => valid && nav(`/time/${valid}`)}>
            <span>Gerar dossiê</span>
          </button>
          <p className="text-[13px] text-muted">
            {idx.data.teams.filter((t) => t.matches >= 10).length} times têm 10+ partidas; times com poucas partidas aparecem com selo de amostra pequena.
          </p>
        </div>
      </section>

      <section aria-labelledby="mod-title">
        <h2 className="section-rule eyebrow mb-4" id="mod-title">Três módulos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MODULES.map((m) => (
            <article key={m.title} className="card card-tilt card-cut p-6 flex flex-col gap-3">
              <span className="eyebrow text-brand">{m.tag}</span>
              <h3>{m.title}</h3>
              <p className="text-muted">{m.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="ds-title">
        <h2 className="section-rule eyebrow mb-4" id="ds-title">O dataset</h2>
        <dl className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            ['Partidas', d.matches], ['Rounds', d.rounds], ['Times', d.teams], ['Plants', d.plants], ['Abates válidos', d.kills],
          ].map(([l, v]) => (
            <div key={l as string} className="card p-5">
              <dt className="eyebrow">{l}</dt>
              <dd className="font-display text-5xl tabular mt-1">{num(v as number)}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="card p-5">
            <div className="eyebrow mb-2">Torneios e fases</div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
              {d.sources.map((s) => (
                <li key={s.source} className="flex justify-between gap-2"><span>{SOURCE_SHORT(s.source)}</span><span className="tabular text-muted">{s.matches}</span></li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <div className="eyebrow mb-2">Mapas</div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
              {d.maps.map((m) => (
                <li key={m.map} className="flex justify-between gap-2"><span>{mapName(m.map)}</span><span className="tabular text-muted">{m.matches}</span></li>
              ))}
            </ul>
            <p className="mt-3 text-muted">Período: {date(d.first_date)} a {date(d.last_date)}. Dados exclusivamente dos JSON fornecidos pela organização.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
