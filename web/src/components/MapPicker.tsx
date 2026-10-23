import { mapName } from '../lib/labels'

/** Seleção múltipla de mapas (chips com aria-pressed). */
export function MapPicker({ maps, selected, onChange, counts }: { maps: string[]; selected: string[]; onChange: (v: string[]) => void; counts?: Record<string, number> }) {
  const toggle = (m: string) => onChange(selected.includes(m) ? selected.filter((x) => x !== m) : [...selected, m])
  return (
    <div role="group" aria-label="Mapas" className="flex flex-wrap gap-2">
      {maps.map((m) => (
        <button key={m} type="button" aria-pressed={selected.includes(m)} className="btn-ghost" onClick={() => toggle(m)}>
          {mapName(m)}
          {counts && <span className="tabular opacity-75">({counts[m] ?? 0})</span>}
        </button>
      ))}
    </div>
  )
}

/** Seleção de um mapa (fatia do perfil). */
export function MapSelect({ maps, value, onChange, label = 'Mapa', includeAll = true, counts }: { maps: string[]; value: string; onChange: (v: string) => void; label?: string; includeAll?: boolean; counts?: Record<string, number> }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      <select className="field min-w-44" value={value} onChange={(e) => onChange(e.target.value)}>
        {includeAll && <option value="all">Todos os mapas</option>}
        {maps.map((m) => (
          <option key={m} value={m}>
            {mapName(m)}{counts ? ` (${counts[m] ?? 0})` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
