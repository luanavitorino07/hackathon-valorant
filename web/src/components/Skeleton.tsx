export function Skeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`} aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-16 bg-surface border border-border" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="card p-6 border-alert/50" role="alert">
      <div className="eyebrow text-alert">Não foi possível carregar os dados</div>
      <p className="mt-2 text-sm text-muted">{message}. Rode o pipeline (<code>scoutroom all</code>) para gerar os arquivos em <code>web/public/data</code>.</p>
    </div>
  )
}
