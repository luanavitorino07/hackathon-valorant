import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Footer } from './Footer'
import { lastTeam } from '../lib/prefs'

/** Tilt 3D + brilho que segue o cursor nos elementos .card-tilt (delegação, sem re-render). */
function useCardTilt() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const MAX = 5 // graus
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.card-tilt')
      if (!el) return
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      el.style.setProperty('--ry', `${((px - 0.5) * 2 * MAX).toFixed(2)}deg`)
      el.style.setProperty('--rx', `${((0.5 - py) * 2 * MAX).toFixed(2)}deg`)
      el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
      el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
    }
    const onLeave = (e: PointerEvent) => {
      const el = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('.card-tilt') : null
      if (!el || el.contains(e.relatedTarget as Node | null)) return
      el.style.setProperty('--rx', '0deg')
      el.style.setProperty('--ry', '0deg')
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerout', onLeave, { passive: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerout', onLeave)
    }
  }, [])
}

export function AppShell({ children }: { children: ReactNode }) {
  useCardTilt()
  const loc = useLocation()
  const team = lastTeam()
  const q = team ? `?time=${team}` : ''
  const links = [
    { to: team ? `/time/${team}` : '/', label: 'Dossiê', match: '/time' },
    { to: team ? `/veto?a=${team}` : '/veto', label: 'Veto', match: '/veto' },
    { to: `/posplant${q}`, label: 'Pós-plant', match: '/posplant' },
    { to: `/economia${q}`, label: 'Economia', match: '/economia' },
    { to: '/metodo', label: 'Método', match: '/metodo' },
  ]
  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-bone focus:text-ink focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>
      <header className="border-b border-border bg-bg/95 sticky top-0 z-40 no-print">
        <div className="mx-auto max-w-[1280px] px-6 h-16 flex items-center justify-between gap-6">
          <NavLink to="/" className="flex items-center gap-2 no-underline" aria-label="ScoutRoom, início">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 32 32"><path d="M6 26 L16 6 L26 26 Z" fill="none" stroke="var(--color-brand)" strokeWidth="3.5" /><circle cx="16" cy="19" r="3" fill="var(--color-bone)" /></svg>
            <span className="font-display text-[28px] tracking-wider leading-none mt-1">ScoutRoom</span>
          </NavLink>
          <nav aria-label="Principal">
            <ul className="flex items-center gap-1">
              {links.map((l) => {
                const active = loc.pathname.startsWith(l.match)
                return (
                  <li key={l.label}>
                    <NavLink
                      to={l.to}
                      aria-current={active ? 'page' : undefined}
                      className={`block px-3 py-2 text-[13px] font-semibold uppercase tracking-[0.12em] border-b-2 ${
                        active ? 'border-brand text-bone' : 'border-transparent text-muted hover:text-bone'
                      }`}
                    >
                      {l.label}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
      </header>
      <main id="conteudo" className="flex-1 mx-auto w-full max-w-[1280px] px-6 py-8 min-h-screen">
        {children}
      </main>
      <Footer />
    </div>
  )
}
