import { describe, expect, it } from 'vitest'
import {
  bestAvailable,
  isPlaceholder,
  parseVideoId,
  QUALITIES,
  qualityByName,
  shortUrl,
  thumbnailFilename,
  thumbnailUrl,
  thumbnailsFor,
  watchUrl,
} from './youtube'

describe('parseVideoId', () => {
  it('accepts a bare id', () => {
    expect(parseVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('  dQw4w9WgXcQ  ')).toBe('dQw4w9WgXcQ')
  })

  it('accepts a standard watch url', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('http://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('accepts a watch url with extra parameters', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('accepts a short link', () => {
    expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ')
  })

  it('accepts shorts, embeds, live and legacy v urls', () => {
    expect(parseVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('https://www.youtube.com/v/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('accepts a mobile or music host', () => {
    expect(parseVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('accepts a bare id used as the whole path', () => {
    expect(parseVideoId('https://www.youtube.com/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('finds the id in pasted text with surrounding noise', () => {
    expect(parseVideoId('check this out https://youtu.be/dQw4w9WgXcQ it is great')).toBe('dQw4w9WgXcQ')
  })

  it('rejects empty and clearly invalid input', () => {
    expect(parseVideoId('')).toBeNull()
    expect(parseVideoId('   ')).toBeNull()
    expect(parseVideoId('https://example.com/watch?v=tooshort')).toBeNull()
    expect(parseVideoId('not a video at all')).toBeNull()
  })

  it('does not mistake a random 11-character word for an id', () => {
    // "hello world" is 10 and 5, so nothing qualifies; a long word would.
    expect(parseVideoId('a very long word')).toBeNull()
  })
})

describe('url builders', () => {
  it('builds thumbnail urls for each quality', () => {
    expect(thumbnailUrl('dQw4w9WgXcQ', 'maxresdefault')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg')
    expect(thumbnailUrl('dQw4w9WgXcQ', 'hqdefault')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })

  it('builds watch and short urls', () => {
    expect(watchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(shortUrl('dQw4w9WgXcQ')).toBe('https://youtu.be/dQw4w9WgXcQ')
  })

  it('returns one thumbnail per quality, each with a url', () => {
    const list = thumbnailsFor('dQw4w9WgXcQ')
    expect(list).toHaveLength(QUALITIES.length)
    expect(list[0].url).toContain('dQw4w9WgXcQ')
  })

  it('names files by id and quality', () => {
    expect(thumbnailFilename('dQw4w9WgXcQ', 'maxresdefault')).toBe('dQw4w9WgXcQ-maxresdefault.jpg')
  })
})

describe('isPlaceholder', () => {
  it('treats the 120x90 stand-in as missing', () => {
    expect(isPlaceholder(120, 90)).toBe(true)
    expect(isPlaceholder(1280, 720)).toBe(false)
    expect(isPlaceholder(480, 360)).toBe(false)
  })
})

describe('qualityByName', () => {
  it('finds a size by its filename stem', () => {
    expect(qualityByName('maxresdefault')?.width).toBe(1280)
    expect(qualityByName('hqdefault')?.height).toBe(360)
  })

  it('returns undefined for a size that is not offered', () => {
    expect(qualityByName('default')).toBeUndefined()
    expect(qualityByName('nope')).toBeUndefined()
  })
})

describe('bestAvailable', () => {
  it('prefers the highest quality that exists', () => {
    expect(bestAvailable({ maxresdefault: true, hq720: true, hqdefault: true })).toBe('maxresdefault')
  })

  it('skips sizes the video does not have', () => {
    expect(bestAvailable({ maxresdefault: false, hq720: false, sddefault: true, hqdefault: true })).toBe('sddefault')
  })

  it('falls back to the first size when nothing is known yet', () => {
    expect(bestAvailable({})).toBe(QUALITIES[0].name)
  })

  it('falls back to the first size when every size is missing', () => {
    const all: Record<string, boolean> = {}
    for (const quality of QUALITIES) all[quality.name] = false
    expect(bestAvailable(all)).toBe(QUALITIES[0].name)
  })
})
