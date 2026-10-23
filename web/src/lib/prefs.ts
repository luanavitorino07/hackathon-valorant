// Preferência local (conveniência por visitante): último time aberto. Falha silenciosa sem storage.
const KEY = 'scoutroom:lastTeam'

export function lastTeam(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function rememberTeam(slug: string) {
  try {
    localStorage.setItem(KEY, slug)
  } catch {
    /* sem storage: ignora */
  }
}
