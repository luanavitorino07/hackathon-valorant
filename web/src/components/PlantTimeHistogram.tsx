import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { mmss, num, pct } from '../lib/format'

interface Props {
  edges: number[]
  team: number[]
  league: number[]
  teamName: string
  terciles?: [number, number] | null
}

/** Distribuição do tempo do plant (fração dos plants por faixa de 5 s): time em destaque, liga em cinza. */
export function PlantTimeHistogram({ edges, team, league, teamName, terciles }: Props) {
  const tt = team.reduce((a, b) => a + b, 0) || 1
  const lt = league.reduce((a, b) => a + b, 0) || 1
  const data = team.map((c, i) => ({ bin: `${edges[i]}`, label: `${mmss(edges[i])}–${mmss(edges[i + 1])}`, team: c / tt, league: league[i] / lt, nTeam: c, nLeague: league[i] }))
  const nTeam = team.reduce((a, b) => a + b, 0)
  return (
    <figure className="m-0">
      <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted mb-2" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 bg-brand" />{teamName} (n = {num(nTeam)})</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 bg-muted/60" />Liga (n = {num(lt)})</span>
        {terciles && <span>Tracejado: terços da liga ({mmss(terciles[0])} e {mmss(terciles[1])})</span>}
      </div>
      <div role="img" aria-label={`Distribuição do tempo do plant de ${teamName} comparada à liga. Tabela equivalente abaixo.`} style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="bin" tickFormatter={(v) => mmss(Number(v))} tick={{ fill: 'var(--color-muted)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--color-border-strong)' }} interval={1} />
            <YAxis tickFormatter={(v) => pct(v)} tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              cursor={{ fill: 'rgba(236,232,225,0.06)' }}
              isAnimationActive={false}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="bg-surface-strong border border-border-strong px-3 py-2 text-[13px] tabular">
                    <div className="font-semibold">{payload[0].payload.label}</div>
                    <div>{teamName}: {pct(payload[0].payload.team)} ({payload[0].payload.nTeam})</div>
                    <div>Liga: {pct(payload[0].payload.league)} ({payload[0].payload.nLeague})</div>
                  </div>
                ) : null
              }
            />
            {terciles?.map((t) => <ReferenceLine key={t} x={`${Math.floor(t / 5) * 5}`} stroke="var(--color-muted)" strokeDasharray="3 3" />)}
            <Bar dataKey="team" fill="var(--color-brand)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="league" fill="rgba(154,166,177,0.6)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-[13px] text-muted">Ver tabela</summary>
        <table className="data-table w-full mt-2">
          <thead><tr><th scope="col">Faixa</th><th scope="col">{teamName}</th><th scope="col">Liga</th></tr></thead>
          <tbody>{data.filter((d) => d.nTeam || d.nLeague).map((d) => <tr key={d.bin}><td className="tabular">{d.label}</td><td className="tabular">{pct(d.team)} ({d.nTeam})</td><td className="tabular">{pct(d.league)} ({d.nLeague})</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  )
}
