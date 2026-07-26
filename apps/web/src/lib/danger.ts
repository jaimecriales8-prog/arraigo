// Nivel de peligrosidad del caso (1-5, 5 = más peligroso). Escala de color
// verde → rojo reutilizada en la lista de casos, el mapa, el detalle y el reporte.
export const DANGER_COLORS: Record<number, string> = {
  1: '#16a34a',
  2: '#84cc16',
  3: '#f59e0b',
  4: '#f97316',
  5: '#dc2626',
}

export const DANGER_LABELS: Record<number, string> = {
  1: 'Muy bajo',
  2: 'Bajo',
  3: 'Medio',
  4: 'Alto',
  5: 'Muy alto',
}

export function dangerColor(level: number): string {
  return DANGER_COLORS[level] ?? '#6b7280'
}

export function dangerLabel(level: number): string {
  return DANGER_LABELS[level] ?? `Nivel ${level}`
}
