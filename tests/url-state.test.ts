import { describe, it, expect } from 'vitest'
import { encodeState, decodeState } from '../src/context/AppContext'
import type { PinAssignment } from '../src/types/chip'

describe('URL state encoding', () => {
  const mapping: PinAssignment[] = [
    { gpio: 21, role: 'I2C_SDA', label: 'Display SDA' },
    { gpio: 22, role: 'I2C_SCL', label: 'Display SCL' },
  ]

  it('round-trips chip id and mapping', () => {
    const encoded = encodeState('esp32', mapping)
    const decoded = decodeState(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.chipId).toBe('esp32')
    expect(decoded!.mapping).toHaveLength(2)
    expect(decoded!.mapping[0].gpio).toBe(21)
    expect(decoded!.mapping[0].role).toBe('I2C_SDA')
    expect(decoded!.mapping[0].label).toBe('Display SDA')
  })

  it('returns null for corrupted input', () => {
    expect(decodeState('not-valid-base64!!!')).toBeNull()
    expect(decodeState('')).toBeNull()
  })

  it('handles empty mapping', () => {
    const encoded = encodeState('esp32s3', [])
    const decoded = decodeState(encoded)
    expect(decoded!.chipId).toBe('esp32s3')
    expect(decoded!.mapping).toHaveLength(0)
  })
})
