import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MASCOT_IMAGES, type GummyMood } from '@/lib/brand/mascot-assets'

/** VP8X (extended WebP) canvas size: 24-bit little-endian width-1 / height-1 at bytes 24..29. */
function webpSize(buf: Buffer) {
  expect(buf.toString('ascii', 0, 4)).toBe('RIFF')
  expect(buf.toString('ascii', 8, 12)).toBe('WEBP')
  expect(buf.toString('ascii', 12, 16)).toBe('VP8X') // alpha images are always VP8X
  return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 }
}

describe('Gummy artwork registry', () => {
  const moods: GummyMood[] = ['happy', 'thinking', 'celebrate', 'cheer', 'oops', 'hero', 'coach', 'launch']

  it('has real artwork for every mood', () => {
    for (const mood of moods) expect(MASCOT_IMAGES[mood], mood).toBeDefined()
  })

  it('points at files that exist, with an alpha channel and the registered size', () => {
    for (const [mood, art] of Object.entries(MASCOT_IMAGES)) {
      const buf = readFileSync(join(process.cwd(), 'public', art!.src))
      const size = webpSize(buf)
      expect(size, mood).toEqual({ width: art!.width, height: art!.height })
      expect(buf[20]! & 0x10, `${mood} has alpha`).toBe(0x10)
    }
  })

  it('keeps outfit anchors inside the image', () => {
    for (const art of Object.values(MASCOT_IMAGES)) {
      for (const v of [art!.face.x, art!.face.y, art!.crown.x, art!.crown.y]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })
})
