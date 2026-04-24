import { validateBbox } from '@/lib/geo'

describe('bbox validation used in GET /api/cats', () => {
  it('rejects missing params', () => {
    expect(validateBbox('', '', '', '')).toBeNull()
  })

  it('rejects swLat >= neLat', () => {
    expect(validateBbox('19.5', '72.8', '19.0', '73.0')).toBeNull()
  })

  it('accepts valid Mumbai bounding box', () => {
    const result = validateBbox('18.87', '72.77', '19.27', '73.07')
    expect(result).not.toBeNull()
    expect(result?.swLat).toBe(18.87)
  })
})
