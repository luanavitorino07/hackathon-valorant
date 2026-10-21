import type { ReactNode } from 'react'

export function Section({ label, title, children, actions, id }: { label: string; title?: string; children: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <section className="mt-10 first:mt-0" aria-labelledby={id}>
      <h2 className="section-rule eyebrow mb-3">{label}</h2>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          {title && <h3 id={id}>{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}
