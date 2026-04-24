import { roundCoord, validateBbox } from '@/lib/geo'

describe('roundCoord', () => {
  it('rounds to 3 decimal places by default', () => {
    expect(roundCoord(19.123456789)).toBe(19.123)
  })

  it('rounds up correctly', () => {
    expect(roundCoord(72.8776543)).toBe(72.878)
  })

  it('handles negative coordinates', () => {
    expect(roundCoord(-18.9999)).toBe(-19.0)
  })

  it('accepts custom precision', () => {
    expect(roundCoord(19.123456, 5)).toBe(19.12346)
  })
})

describe('validateBbox', () => {
  it('returns parsed numbers for valid bbox', () => {
    const result = validateBbox('18.87', '72.77', '19.27', '73.07')
    expect(result).toEqual({ swLat: 18.87, swLng: 72.77, neLat: 19.27, neLng: 73.07 })
  })

  it('returns null when swLat >= neLat', () => {
    expect(validateBbox('19.27', '72.77', '18.87', '73.07')).toBeNull()
  })

  it('returns null for non-numeric values', () => {
    expect(validateBbox('abc', '72.77', '19.27', '73.07')).toBeNull()
  })

  it('returns null for out-of-range lat', () => {
    expect(validateBbox('-91', '72.77', '19.27', '73.07')).toBeNull()
  })

  it('returns null for out-of-range lng', () => {
    expect(validateBbox('18.87', '-181', '19.27', '73.07')).toBeNull()
  })
})
