import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TimelineRow } from '../lib/types'
import { credits } from '../lib/format'
import { BUY_LABEL } from '../lib/labels'

interface Props {
  rows: TimelineRow[]
  teamName: string
  oppName: string
}

const BUY_SHORT: Record<string, string> = { pistol: 'P', eco: 'E', force: 'F', full: 'C' }

interface Datum {
  round: string
  r: number
  team: number
  opp: number
  buy: string
  oppBuy: string
  won: boolean
  side: string
}

function Tick(props: { x?: number; y?: number; payload?: { value: string; index: number }; data: Datum[] }) {
  const { x = 0, y = 0, payload, data } = props
  const d = payload ? data[payload.index] : undefined
  if (!d) return null
  return (
    <g transform={`translate(${x},${y})`}>
      <text y={12} textAnchor="middle" fill="var(--color-muted)" fontSize={11}>{d.r + 1}</text>
      <rect x={-5} y={18} width={10} height={10} fill={d.won ? 'var(--color-positive)' : 'none'} stroke={d.won ? 'var(--color-positive)' : 'var(--color-muted)'} strokeWidth={1.5} />
      <text y={42} textAnchor="middle" fill="var(--color-bone)" fontSize={10} fontWeight={600}>{BUY_SHORT[d.buy]}</text>
    </g>
  )
}

function TooltipBox({ active, payload, teamName, oppName }: { active?: boolean; payload?: { payload: Datum }[]; teamName: string; oppName: string }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface-strong border border-border-strong px-3 py-2 text-[13px] tabular">
      <div className="font-semibold">Round {d.r + 1} · {d.side === 'atk' ? 'ATK' : 'DEF'} · {d.won ? 'vencido' : 'perdido'}</div>
      <div><span className="text-muted">{teamName}:</span> {credits(d.team)} ({BUY_LABEL[d.buy as keyof typeof BUY_LABEL]})</div>
      <div><span className="text-muted">{oppName}:</span> {credits(d.opp)} ({BUY_LABEL[d.oppBuy as keyof typeof BUY_LABEL]})</div>
    </div>
  )
}

/** Barras de loadoutValue médio dos dois times por round (sem eixo duplo). */
export function EconTimeline({ rows, teamName, oppName }: Props) {
  const data: Datum[] = rows.map(([r, team, opp, buy, oppBuy, won, side]) => ({ round: `R${r + 1}`, r, team, opp, buy, oppBuy, won: won === 1, side }))
  const hasOT = rows.some((r) => r[0] >= 24)
  return (
    <figure className="m-0">
      <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted mb-2" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 bg-brand" />{teamName}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 bg-muted/60" />{oppName}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 bg-positive" />round vencido por {teamName}</span>
        <span>P = pistol · E = eco · F = force · C = full (compra completa)</span>
      </div>
      <div role="img" aria-label={`Valor médio de equipamento por round, ${teamName} contra ${oppName}. Tabela equivalente abaixo.`} style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 40, left: 0 }} barGap={2} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="round" interval={0} tickLine={false} axisLine={{ stroke: 'var(--color-border-strong)' }} tick={<Tick data={data} />} height={48} />
            <YAxis tickFormatter={(v) => credits(v)} tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip cursor={{ fill: 'rgba(236,232,225,0.06)' }} content={<TooltipBox teamName={teamName} oppName={oppName} />} isAnimationActive={false} />
            <ReferenceLine x="R13" stroke="var(--color-bone)" strokeDasharray="3 3" label={{ value: '2º tempo (pistol)', position: 'insideTopLeft', fill: 'var(--color-muted)', fontSize: 11 }} />
            {hasOT && <ReferenceLine x="R25" stroke="var(--color-alert)" strokeDasharray="3 3" label={{ value: 'Prorrogação', position: 'insideTopLeft', fill: 'var(--color-alert)', fontSize: 11 }} />}
            <Bar dataKey="team" name={teamName} fill="var(--color-brand)" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
            <Bar dataKey="opp" name={oppName} fill="rgba(154,166,177,0.6)" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-[13px] text-muted">Ver tabela da linha do tempo</summary>
        <table className="data-table w-full mt-2">
          <thead><tr><th scope="col">Round</th><th scope="col">Lado</th><th scope="col">{teamName}</th><th scope="col">Compra</th><th scope="col">{oppName}</th><th scope="col">Compra adv.</th><th scope="col">Resultado</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.r}><td className="tabular">{d.r + 1}</td><td>{d.side === 'atk' ? 'ATK' : 'DEF'}</td><td className="tabular">{credits(d.team)}</td><td>{BUY_LABEL[d.buy as keyof typeof BUY_LABEL]}</td><td className="tabular">{credits(d.opp)}</td><td>{BUY_LABEL[d.oppBuy as keyof typeof BUY_LABEL]}</td><td>{d.won ? 'Vencido' : 'Perdido'}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
