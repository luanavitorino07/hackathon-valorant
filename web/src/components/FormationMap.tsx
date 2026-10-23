import { useEffect, useMemo, useState } from 'react'
import type { MapFile, Plant } from '../lib/types'
import { mapName } from '../lib/labels'
import { getMapOverlayBounds } from '../lib/mapConfig'

// Orientação do minimapa: x_svg = y_jogo, y_svg = −x_jogo (eixos trocados, ver DECISIONS D12).
const toSvg = (x: number, y: number): [number, number] => [y, -x]

function useDensityImage(map: MapFile | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!map) return
    const g = map.grid
    const c = document.createElement('canvas')
    c.width = g
    c.height = g
    const ctx = c.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(g, g)
    for (let i = 0; i < g * g; i++) {
      const v = map.density[i] / 255
      // tinta "bone" sobre transparente: a forma do mapa vem das posições reais da liga
      img.data[i * 4] = 236
      img.data[i * 4 + 1] = 232
      img.data[i * 4 + 2] = 225
      img.data[i * 4 + 3] = v === 0 ? 0 : Math.round(18 + 70 * v)
    }
    ctx.putImageData(img, 0, 0)
    setUrl(c.toDataURL())
  }, [map])
  return map ? url : null
}

interface Props {
  map: MapFile | null
  plants: Plant[]
  site: string | 'all'
  selected?: Plant | null
  zoom?: 'site' | 'map'
  title?: string
}

/** Pontos no instante do plant: ATK (círculo vermelho) e DEF (losango ciano), seta curta = mira. */
export function FormationMap({ map, plants, site, selected, zoom = 'site', title }: Props) {
  const img = useDensityImage(map)
  const overlay = useMemo(() => getMapOverlayBounds(map?.map), [map?.map])

  const { box, R, center } = useMemo(() => {
    if (!map) return { box: null, R: null, center: null }
    const b = map.bounds
    const full = { x: b.ymin, y: -b.xmax, w: b.ymax - b.ymin, h: b.xmax - b.xmin }
    const s = site !== 'all' ? map.sites[site] : null
    if (zoom === 'map' || !s) return { box: full, R: s?.R ?? null, center: s ? toSvg(s.cx, s.cy) : null }
    const [cx, cy] = toSvg(s.cx, s.cy)
    const half = Math.max(2600, (s.R ?? 1500) * 3.2)
    return { box: { x: cx - half, y: cy - half, w: 2 * half, h: 2 * half }, R: s.R, center: [cx, cy] as [number, number] }
  }, [map, site, zoom])

  if (!map || !box) {
    return <div className="aspect-square w-full bg-surface border border-border" aria-hidden="true" />
  }
  const unit = box.w / 100 // escala visual proporcional ao zoom
  const b = map.bounds
  const imgBox = { x: b.ymin, y: -b.xmax, w: b.ymax - b.ymin, h: b.xmax - b.xmin }
  const showArrows = !!selected || plants.length <= 12
  const list = selected ? [selected] : plants
  const faded = selected ? plants.filter((p) => p !== selected) : []
  const ariaLabel = `${title ?? 'Formação no instante do plant'}: ${mapName(map.map)}${site !== 'all' ? `, BOMB ${site}` : ''}, ${plants.length} plants. Atacantes em círculos vermelhos, defensores em losangos cianos.`

  const m = unit * 2.5
  const cl = unit * 6
  const cTL = `M ${box.x + m} ${box.y + m + cl} L ${box.x + m} ${box.y + m} L ${box.x + m + cl} ${box.y + m}`
  const cTR = `M ${box.x + box.w - m - cl} ${box.y + m} L ${box.x + box.w - m} ${box.y + m} L ${box.x + box.w - m} ${box.y + m + cl}`
  const cBL = `M ${box.x + m} ${box.y + box.h - m - cl} L ${box.x + m} ${box.y + box.h - m} L ${box.x + m + cl} ${box.y + box.h - m}`
  const cBR = `M ${box.x + box.w - m - cl} ${box.y + box.h - m} L ${box.x + box.w - m} ${box.y + box.h - m} L ${box.x + box.w - m} ${box.y + box.h - m - cl}`

  const marker = (role: 'atk' | 'def', x: number, y: number, v: number, key: string, opacity = 1, arrows = showArrows) => {
    const [sx, sy] = toSvg(x, y)
    const r = unit * 1.15
    const color = role === 'atk' ? 'var(--color-atk)' : 'var(--color-def)'
    const len = unit * 4
    const dx = Math.sin(v) * len
    const dy = -Math.cos(v) * len
    return (
      <g key={key} opacity={opacity}>
        {arrows && <line x1={sx} y1={sy} x2={sx + dx} y2={sy + dy} stroke={color} strokeWidth={unit * 0.35} strokeLinecap="round" />}
        {role === 'atk' ? (
          <circle cx={sx} cy={sy} r={r} fill={color} stroke="var(--color-bg)" strokeWidth={unit * 0.3} />
        ) : (
          <path d={`M${sx} ${sy - r * 1.25} L${sx + r * 1.25} ${sy} L${sx} ${sy + r * 1.25} L${sx - r * 1.25} ${sy} Z`} fill={color} stroke="var(--color-bg)" strokeWidth={unit * 0.3} />
        )}
      </g>
    )
  }

  return (
    <figure className="m-0">
      <div className="map-stage">
      <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} role="img" aria-label={ariaLabel} className={`w-full aspect-square bg-[#070c12] border border-border block map-tilt${selected ? ' is-flat' : ''}`}>
        <title>{ariaLabel}</title>
        <defs>
          <radialGradient id="map-radar-bg" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#14212e" />
            <stop offset="60%" stopColor="#0c151e" />
            <stop offset="100%" stopColor="#070c12" />
          </radialGradient>
          <pattern id="tactical-grid" width={box.w / 12} height={box.h / 12} patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2={box.w / 12} y2="0" stroke="rgba(236,232,225,0.035)" strokeWidth={unit * 0.15} />
            <line x1="0" y1="0" x2="0" y2={box.h / 12} stroke="rgba(236,232,225,0.035)" strokeWidth={unit * 0.15} />
          </pattern>
          <filter id="density-soft" x="0" y="0" width="100%" height="100%">
            <feGaussianBlur stdDeviation={(imgBox.w / (map.grid || 1)) * 0.6} />
          </filter>
        </defs>
        {/* Fundo fade tático estilo radar Valorant com micro-grid */}
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="url(#map-radar-bg)" />
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="url(#tactical-grid)" />
        {/* Contornos oficiais das paredes e corredores do mapa */}
        {overlay && (
          <image
            href={overlay.imagePath}
            x={overlay.x}
            y={overlay.y}
            width={overlay.w}
            height={overlay.h}
            preserveAspectRatio="none"
            opacity={0.8}
            className="pointer-events-none select-none"
          />
        )}
        {/* Preenchimento suave de densidade de circulação da liga */}
        {img && (
          <image
            filter="url(#density-soft)"
            href={img}
            x={imgBox.x}
            y={imgBox.y}
            width={imgBox.w}
            height={imgBox.h}
            preserveAspectRatio="none"
            opacity={overlay ? 0.35 : 1}
          />
        )}
        {Object.entries(map.sites).map(([name, s]) => {
          const [cx, cy] = toSvg(s.cx, s.cy)
          const active = site === 'all' || site === name
          return (
            <g key={name} opacity={active ? 1 : 0.35}>
              {s.R && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={s.R}
                  fill="none"
                  stroke="var(--color-bone)"
                  strokeOpacity="0.55"
                  strokeWidth={unit * 0.25}
                  strokeDasharray={`${unit} ${unit * 0.8}`}
                />
              )}
              <text
                x={cx}
                y={cy - (s.R ?? 800) - unit * 1.5}
                textAnchor="middle"
                fill="var(--color-bone)"
                fontSize={unit * 5}
                fontFamily="var(--font-display)"
              >
                {name}
              </text>
            </g>
          )
        })}
        {center && R && zoom === 'site' && (
          <circle cx={center[0]} cy={center[1]} r={R * 2} fill="none" stroke="var(--color-muted)" strokeOpacity="0.35" strokeWidth={unit * 0.2} strokeDasharray={`${unit * 0.4} ${unit}`} />
        )}
        {faded.map((p, i) => (
          <g key={`f${i}`}>
            {p.atk.map(([x, y, v], j) => marker('atk', x, y, v, `fa${i}-${j}`, 0.18, false))}
            {p.def.map(([x, y, v], j) => marker('def', x, y, v, `fd${i}-${j}`, 0.18, false))}
          </g>
        ))}
        {list.map((p, i) => {
          const [px, py] = toSvg(p.p[0], p.p[1])
          return (
            <g key={`p${i}`} opacity={selected ? 1 : Math.max(0.35, 1 - plants.length / 120)}>
              {p.atk.map(([x, y, v], j) => marker('atk', x, y, v, `a${i}-${j}`))}
              {p.def.map(([x, y, v], j) => marker('def', x, y, v, `d${i}-${j}`))}
              <rect x={px - unit * 1.1} y={py - unit * 1.1} width={unit * 2.2} height={unit * 2.2} fill="var(--color-bone)" stroke="var(--color-bg)" strokeWidth={unit * 0.3} transform={`rotate(45 ${px} ${py})`} />
            </g>
          )
        })}
        {/* Cantoneiras táticas nos quatro cantos do radar */}
        <g className={`map-corners${selected ? ' is-active' : ''}`} stroke="var(--color-bone)" strokeOpacity="0.25" strokeWidth={unit * 0.25} fill="none" strokeLinecap="square">
          <path d={cTL} />
          <path d={cTR} />
          <path d={cBL} />
          <path d={cBR} />
        </g>
      </svg>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-4 text-[13px] text-muted">
        <span className="inline-flex items-center gap-1.5"><svg aria-hidden="true" width="12" height="12"><circle cx="6" cy="6" r="5" fill="var(--color-atk)" /></svg>Atacante vivo</span>
        <span className="inline-flex items-center gap-1.5"><svg aria-hidden="true" width="12" height="12"><path d="M6 0.5 L11.5 6 L6 11.5 L0.5 6 Z" fill="var(--color-def)" /></svg>Defensor vivo</span>
        <span className="inline-flex items-center gap-1.5"><svg aria-hidden="true" width="12" height="12"><rect x="2.5" y="2.5" width="7" height="7" fill="var(--color-bone)" transform="rotate(45 6 6)" /></svg>Spike</span>
        <span className="inline-flex items-center gap-1.5"><svg aria-hidden="true" width="16" height="12"><circle cx="8" cy="6" r="5" fill="none" stroke="var(--color-bone)" strokeDasharray="2 2" /></svg>Raio R do BOMB (2R tracejado fraco)</span>
        {showArrows && <span>Traço curto = direção da mira</span>}
        <span>Fundo: contornos oficiais do mapa com densidade de posições da liga</span>
      </figcaption>
    </figure>
  )
}
