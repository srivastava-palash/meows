import type { BoundingBox } from '@/types'

export function roundCoord(coord: number, precision = 3): number {
  const factor = Math.pow(10, precision)
  return Math.round(coord * factor) / factor
}

export function validateBbox(
  swLat: string,
  swLng: string,
  neLat: string,
  neLng: string
): BoundingBox | null {
  const vals = [swLat, swLng, neLat, neLng].map(Number)
  if (vals.some(isNaN)) return null
  const [swLatN, swLngN, neLatN, neLngN] = vals
  if (swLatN >= neLatN || swLngN >= neLngN) return null
  if (swLatN < -90 || neLatN > 90 || swLngN < -180 || neLngN > 180) return null
  return { swLat: swLatN, swLng: swLngN, neLat: neLatN, neLng: neLngN }
}
