// Carregamento sob demanda dos JSON estáticos em public/data (sem backend).
import { useEffect, useState } from 'react'
import type { EvidenceFile, IndexFile, LeagueFile, MapFile, TeamFile } from './types'

const cache = new Map<string, Promise<unknown>>()

export function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}data/${path}`
}

export function loadJson<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = fetch(dataUrl(path)).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} ao carregar ${path}`)
      return r.json()
    })
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return cache.get(path) as Promise<T>
}

export interface Loaded<T> {
  data: T | null
  error: string | null
  loading: boolean
}

export function useJson<T>(path: string | null): Loaded<T> {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string | null }>({ path: null, data: null, error: null })
  useEffect(() => {
    if (!path) return
    let alive = true
    loadJson<T>(path)
      .then((d) => alive && setState({ path, data: d, error: null }))
      .catch((e: Error) => alive && setState({ path, data: null, error: e.message }))
    return () => {
      alive = false
    }
  }, [path])
  if (!path) return { data: null, error: null, loading: false }
  const fresh = state.path === path
  return { data: fresh ? state.data : null, error: fresh ? state.error : null, loading: !fresh }
}

export const useIndex = () => useJson<IndexFile>('index.json')
export const useLeague = () => useJson<LeagueFile>('league.json')
export const useTeam = (slug: string | null | undefined) => useJson<TeamFile>(slug ? `teams/${slug}.json` : null)
export const useEvidence = (slug: string | null | undefined) => useJson<EvidenceFile>(slug ? `evidence/${slug}.json` : null)
export const useMapFile = (map: string | null | undefined) => useJson<MapFile>(map && map !== 'all' ? `maps/${map}.json` : null)
