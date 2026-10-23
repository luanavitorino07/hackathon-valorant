export interface MapCalibration {
  xMultiplier: number
  xScalarToAdd: number
  yScalarToAdd: number
}

export interface MapOverlayBounds {
  x: number
  y: number
  w: number
  h: number
  imagePath: string
}

export const MAP_CALIBRATIONS: Record<string, MapCalibration> = {
  ascent: { xMultiplier: 7e-5, xScalarToAdd: 0.813895, yScalarToAdd: 0.573242 },
  split: { xMultiplier: 7.8e-5, xScalarToAdd: 0.842188, yScalarToAdd: 0.697578 },
  fracture: { xMultiplier: 7.8e-5, xScalarToAdd: 0.556952, yScalarToAdd: 1.155886 },
  bind: { xMultiplier: 5.9e-5, xScalarToAdd: 0.576941, yScalarToAdd: 0.967566 },
  breeze: { xMultiplier: 7e-5, xScalarToAdd: 0.465123, yScalarToAdd: 0.833078 },
  abyss: { xMultiplier: 8.1e-5, xScalarToAdd: 0.5, yScalarToAdd: 0.5 },
  lotus: { xMultiplier: 7.2e-5, xScalarToAdd: 0.454789, yScalarToAdd: 0.917752 },
  sunset: { xMultiplier: 7.8e-5, xScalarToAdd: 0.5, yScalarToAdd: 0.515625 },
  pearl: { xMultiplier: 7.8e-5, xScalarToAdd: 0.480469, yScalarToAdd: 0.916016 },
  summit: { xMultiplier: 7.5e-5, xScalarToAdd: 0.047401, yScalarToAdd: 0.978891 },
  haven: { xMultiplier: 7.5e-5, xScalarToAdd: 1.09345, yScalarToAdd: 0.642728 },
  icebox: { xMultiplier: 7.2e-5, xScalarToAdd: 0.460214, yScalarToAdd: 0.304687 },
}

/**
 * Calcula o retângulo [x, y, w, h] da imagem de radar no sistema de coordenadas do SVG.
 * No SVG do FormationMap: x_svg = y_jogo e y_svg = -x_jogo.
 * A imagem de radar oficial do VALORANT possui alinhamento e orientação idênticos
 * quando projetada com essas dimensões.
 */
export function getMapOverlayBounds(mapSlug: string | null | undefined): MapOverlayBounds | null {
  if (!mapSlug) return null
  const cfg = MAP_CALIBRATIONS[mapSlug.toLowerCase()]
  if (!cfg) return null

  const size = 1 / cfg.xMultiplier
  const x = -cfg.xScalarToAdd / cfg.xMultiplier
  const y = -cfg.yScalarToAdd / cfg.xMultiplier

  return {
    x,
    y,
    w: size,
    h: size,
    imagePath: `${import.meta.env.BASE_URL}maps/${mapSlug.toLowerCase()}.png`,
  }
}
