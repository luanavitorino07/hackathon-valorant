import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useEvidence, useTeam } from '../lib/data'
import { date, num, roundLabel } from '../lib/format'
import { mapName } from '../lib/labels'
import type { MatchRef } from '../lib/types'

export interface EvidenceRequest {
  slug: string
  metric: string
  side?: 'yes' | 'no'
  title: string
  subtitle?: string
}

const Ctx = createContext<(req: EvidenceRequest) => void>(() => {})

export const useEvidenceDrawer = () => useContext(Ctx)

export function EvidenceProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<EvidenceRequest | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const open = useCallback((r: EvidenceRequest) => {
    opener.current = document.activeElement as HTMLElement | null
    setReq(r)
  }, [])
  const close = useCallback(() => {
    setReq(null)
    setTimeout(() => opener.current?.focus(), 0)
  }, [])
  return (
    <Ctx.Provider value={open}>
      {children}
      {req && <Drawer req={req} onClose={close} />}
    </Ctx.Provider>
  )
}

function MiniTimeline({ match, highlight }: { match: MatchRef; highlight: Set<number> }) {
  return (
    <div>
      <div className="eyebrow mb-2">Linha do tempo · {match.opp_name} · {mapName(match.map)} · {match.score_for}–{match.score_against}</div>
      <ol className="flex flex-wrap gap-1" aria-label="Rounds da partida">
        {match.rounds.split('').map((w, i) => {
          const side = match.sides[i] === 'A' ? 'ATK' : 'DEF'
          const hl = highlight.has(i)
          return (
            <li
              key={i}
              title={`${roundLabel(i)} · ${side} · ${w === 'W' ? 'vencido' : 'perdido'}${hl ? ' · evidência' : ''}`}
              className={`relative flex h-8 w-7 flex-col items-center justify-center text-[10px] tabular border ${
                hl ? 'border-bone border-2' : 'border-border'
              } ${w === 'W' ? 'bg-positive/25' : 'bg-transparent'}`}
            >
              <span className="leading-none">{i + 1}</span>
              <span className={`leading-none mt-0.5 ${match.sides[i] === 'A' ? 'text-atk' : 'text-def'}`}>{w === 'W' ? 'V' : '×'}</span>
              {i === 11 && <span aria-hidden="true" className="absolute -right-1 top-0 bottom-0 w-px bg-muted" />}
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-xs text-muted">V = round vencido pelo time, × = perdido; cor do texto = lado (vermelho ATK, ciano DEF); borda clara = round citado.</p>
    </div>
  )
}

function Drawer({ req, onClose }: { req: EvidenceRequest; onClose: () => void }) {
  const ev = useEvidence(req.slug)
  const team = useTeam(req.slug)
  const [which, setWhich] = useState<'yes' | 'no'>(req.side ?? 'yes')
  const [selMatch, setSelMatch] = useState<number | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const titleId = 'evidence-title'

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('button, [href], select, input, [tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const list = ev.data?.metrics[req.metric]
  const refs = useMemo(() => (list ? list[which] : []), [list, which])
  const total = list ? (which === 'yes' ? list.yes_total : list.no_total) : 0
  const matches = team.data?.matches ?? []
  const firstMatch = refs.length ? refs[0][0] : null
  const shownMatch = selMatch ?? firstMatch
  const highlight = useMemo(() => new Set(refs.filter((r) => r[0] === shownMatch).map((r) => r[1])), [refs, shownMatch])

  return (
    <div className="fixed inset-0 z-50 no-print" role="presentation">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute right-0 top-0 bottom-0 w-full max-w-[720px] bg-bg border-l border-border-strong overflow-y-auto animate-slide-in"
      >
        <div className="sticky top-0 z-10 bg-bg border-b border-border p-5 flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Evidências</div>
            <h3 id={titleId} className="mt-1 text-[26px]">{req.title}</h3>
            {req.subtitle && <p className="text-sm text-muted mt-1">{req.subtitle}</p>}
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Fechar painel de evidências">Fechar ✕</button>
        </div>
        <div className="p-5 flex flex-col gap-5">
          {list && list.no_total > 0 && (
            <div role="group" aria-label="Quais rounds mostrar" className="inline-flex">
              <button type="button" className="btn-ghost" aria-pressed={which === 'yes'} onClick={() => { setWhich('yes'); setSelMatch(null) }}>
                Rounds que sustentam ({num(list.yes_total)})
              </button>
              <button type="button" className="btn-ghost -ml-px" aria-pressed={which === 'no'} onClick={() => { setWhich('no'); setSelMatch(null) }}>
                Demais rounds ({num(list.no_total)})
              </button>
            </div>
          )}
          {(ev.loading || team.loading) && <p className="text-muted">Carregando…</p>}
          {!ev.loading && !list && <p className="text-muted">Sem evidências registradas para esta métrica.</p>}
          {list && (
            <>
              <p className="text-sm text-muted">
                {num(total)} {total === 1 ? 'round' : 'rounds'}
                {total > refs.length && <> · mostrando os {refs.length} mais recentes</>}.
                Clique em uma linha para ver a partida na linha do tempo.
              </p>
              {shownMatch !== null && matches[shownMatch] && <MiniTimeline match={matches[shownMatch]} highlight={highlight} />}
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Adversário</th>
                    <th scope="col">Mapa</th>
                    <th scope="col">Round</th>
                    <th scope="col">Lado</th>
                    <th scope="col">Resultado do round</th>
                  </tr>
                </thead>
                <tbody>
                  {refs.map(([mi, r]) => {
                    const m = matches[mi]
                    if (!m) return null
                    const w = m.rounds[r]
                    const s = m.sides[r]
                    return (
                      <tr key={`${mi}-${r}`} className={`cursor-pointer ${mi === shownMatch ? 'bg-surface' : ''}`} onClick={() => setSelMatch(mi)}>
                        <td className="tabular">
                          <button type="button" className="underline decoration-border-strong underline-offset-2 hover:decoration-bone" onClick={() => setSelMatch(mi)}>
                            {date(m.date)}
                          </button>
                        </td>
                        <td>{m.opp_name}</td>
                        <td>{mapName(m.map)}</td>
                        <td className="tabular">{roundLabel(r)}</td>
                        <td className={s === 'A' ? 'text-atk' : 'text-def'}>{s === 'A' ? 'ATK' : 'DEF'}</td>
                        <td>{w === 'W' ? 'Vencido' : 'Perdido'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
