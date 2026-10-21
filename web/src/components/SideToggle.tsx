export type SideFilter = 'atk' | 'def' | 'both'

const OPTIONS: { value: SideFilter; label: string; color?: string }[] = [
  { value: 'atk', label: 'ATK', color: 'var(--color-atk)' },
  { value: 'def', label: 'DEF', color: 'var(--color-def)' },
  { value: 'both', label: 'Ambos' },
]

export function SideToggle({ value, onChange }: { value: SideFilter; onChange: (v: SideFilter) => void }) {
  return (
    <div role="group" aria-label="Lado" className="inline-flex">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          className="btn-ghost -ml-px first:ml-0"
          onClick={() => onChange(o.value)}
        >
          {o.color && (
            o.value === 'atk'
              ? <svg aria-hidden="true" width="10" height="10"><circle cx="5" cy="5" r="4" fill={o.color} /></svg>
              : <svg aria-hidden="true" width="10" height="10"><path d="M5 0.5 L9.5 5 L5 9.5 L0.5 5 Z" fill={o.color} /></svg>
          )}
          {o.label}
        </button>
      ))}
    </div>
  )
}
