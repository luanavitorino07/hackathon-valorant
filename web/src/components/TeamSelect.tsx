import { useId, useMemo, useRef, useState } from 'react'
import type { TeamIndexEntry } from '../lib/types'

export const LEAGUE_OPTION = '__liga__'

interface Props {
  teams: TeamIndexEntry[]
  value: string | null
  onChange: (slug: string) => void
  label?: string
  placeholder?: string
  includeLeague?: boolean
  exclude?: string | null
  large?: boolean
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Combobox acessível com busca e nº de partidas (padrão ARIA 1.2, lista com aria-activedescendant). */
export function TeamSelect({ teams, value, onChange, label = 'Time', placeholder = 'Buscar time…', includeLeague = false, exclude, large = false }: Props) {
  const id = useId()
  const listId = `${id}-list`
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const options = useMemo(() => {
    const base = teams.filter((t) => t.slug !== exclude).map((t) => ({ slug: t.slug, name: t.name, matches: t.matches as number | null }))
    const all = includeLeague ? [{ slug: LEAGUE_OPTION, name: 'Média da liga (adversário médio)', matches: null }, ...base] : base
    const q = normalize(query.trim())
    return q ? all.filter((o) => normalize(o.name).includes(q) || o.slug.includes(q)) : all
  }, [teams, query, includeLeague, exclude])

  const selected = value === LEAGUE_OPTION ? 'Média da liga (adversário médio)' : teams.find((t) => t.slug === value)?.name ?? ''

  const commit = (slug: string) => {
    onChange(slug)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(options.length - 1, open ? a + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      if (open && options[active]) {
        e.preventDefault()
        commit(options[active].slug)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div className="relative flex flex-col gap-1 min-w-64">
      <label htmlFor={id} className="eyebrow">{label}</label>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        className={`field w-full ${large ? 'text-lg py-3' : ''}`}
        placeholder={selected || placeholder}
        value={open ? query : selected}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => {
          setOpen(true)
          setActive(Math.max(0, options.findIndex((o) => o.slug === value)))
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute top-full left-0 right-0 z-30 mt-1 max-h-80 overflow-auto bg-surface-strong border border-border-strong shadow-xl"
        >
          {options.length === 0 && <li className="px-3 py-2 text-sm text-muted">Nenhum time encontrado</li>}
          {options.map((o, i) => (
            <li
              key={o.slug}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={o.slug === value}
              className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer text-sm ${i === active ? 'bg-brand-tint' : ''} ${o.slug === value ? 'font-semibold' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                commit(o.slug)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{o.name}</span>
              {o.matches !== null && <span className="tabular text-muted whitespace-nowrap">{o.matches} {o.matches === 1 ? 'partida' : 'partidas'}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
