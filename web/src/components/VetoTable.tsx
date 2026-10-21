import { useState } from 'react'
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from '@tanstack/react-table'
import type { VetoChip, VetoRow } from '../lib/veto'
import { CHIP_LABEL } from '../lib/veto'
import { num, pct, pp } from '../lib/format'
import { mapName } from '../lib/labels'
import { IntervalBar } from './IntervalBar'

const CHIP_STYLE: Record<VetoChip, string> = {
  pick: 'bg-positive text-ink border-positive',
  ban: 'bg-brand text-ink border-brand',
  neutral: 'bg-transparent text-bone border-border-strong',
  insufficient: 'bg-transparent text-muted border-border-strong border-dashed',
}
const CHIP_ICON: Record<VetoChip, string> = { pick: '▲', ban: '✕', neutral: '•', insufficient: '?' }

export function VetoChipView({ chip }: { chip: VetoChip }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[12px] font-bold uppercase tracking-wider whitespace-nowrap ${CHIP_STYLE[chip]}`}>
      <span aria-hidden="true">{CHIP_ICON[chip]}</span>
      {CHIP_LABEL[chip]}
    </span>
  )
}

const col = createColumnHelper<VetoRow>()

export function VetoTable({ rows, aName, bName, range = 0.2, compact = false }: { rows: VetoRow[]; aName: string; bName: string; range?: number; compact?: boolean }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'advantage', desc: true }])
  const columns = [
    col.accessor('map', { header: 'Mapa', cell: (c) => <span className="font-display text-xl tracking-wide">{mapName(c.getValue())}</span> }),
    col.accessor('expAtk', { header: `${aName} atacando`, cell: (c) => <span className="tabular">{pct(c.getValue())}</span> }),
    col.accessor('expDef', { header: `${aName} defendendo`, cell: (c) => <span className="tabular">{pct(c.getValue())}</span> }),
    col.accessor('advantage', {
      header: 'Vantagem (rounds)',
      cell: (c) => {
        const r = c.row.original
        return (
          <div className="flex items-center gap-3 min-w-56">
            <span className="tabular w-20 text-right font-semibold">{pp(r.advantage)}</span>
            <div className="flex-1 min-w-28">
              <IntervalBar lo={r.lo} hi={r.hi} mean={r.advantage} min={-range} max={range} format={(x) => pp(x)}
                color={r.chip === 'pick' ? 'var(--color-positive)' : r.chip === 'ban' ? 'var(--color-brand)' : 'var(--color-bone)'} />
            </div>
          </div>
        )
      },
    }),
    col.display({
      id: 'interval',
      header: 'Intervalo 80%',
      cell: (c) => <span className="tabular text-muted whitespace-nowrap">{pp(c.row.original.lo)} a {pp(c.row.original.hi)}</span>,
    }),
    col.accessor('nA', {
      header: 'n (rounds)',
      cell: (c) => {
        const r = c.row.original
        return <span className="tabular text-muted whitespace-nowrap">{num(r.nA)} / {Number.isFinite(r.nB) ? num(r.nB) : 'liga'}</span>
      },
    }),
    col.accessor('chip', { header: 'Sugestão', cell: (c) => <VetoChipView chip={c.getValue()} />, sortingFn: (a, b) => ['pick', 'neutral', 'insufficient', 'ban'].indexOf(a.original.chip) - ['pick', 'neutral', 'insufficient', 'ban'].indexOf(b.original.chip) }),
  ]
  const table = useReactTable({ data: rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() })
  const hidden = compact ? new Set(['interval', 'expAtk', 'expDef']) : new Set<string>()
  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full">
        <caption className="sr-only">Vantagem estimada de {aName} contra {bName} por mapa, com intervalo de 80% e sugestão de veto</caption>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.filter((h) => !hidden.has(h.column.id)).map((h) => {
                const s = h.column.getIsSorted()
                return (
                  <th key={h.id} scope="col" aria-sort={s === 'asc' ? 'ascending' : s === 'desc' ? 'descending' : 'none'}>
                    {h.column.getCanSort() ? (
                      <button type="button" className="uppercase tracking-[0.12em] hover:text-bone" onClick={h.column.getToggleSortingHandler()}>
                        {flexRender(h.column.columnDef.header, h.getContext())} {s === 'asc' ? '↑' : s === 'desc' ? '↓' : ''}
                      </button>
                    ) : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().filter((c) => !hidden.has(c.column.id)).map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
