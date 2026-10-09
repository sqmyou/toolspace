import { describe, expect, it } from 'vitest'
import { appUrl, ARTWORK_FILENAMES, assetByName, ASSETS, artworkFilename, imageUrl, parseAppId } from './steam'

describe('parseAppId', () => {
  it('accepts a bare id', () => {
    expect(parseAppId('570')).toBe('570')
    expect(parseAppId('  570  ')).toBe('570')
  })

  it('accepts a store url, with or without a slug', () => {
    expect(parseAppId('https://store.steampowered.com/app/570/')).toBe('570')
    expect(parseAppId('store.steampowered.com/app/570/Dota_2/')).toBe('570')
    expect(parseAppId('https://store.steampowered.com/app/570/Dota_2/?l=english')).toBe('570')
  })

  it('accepts community and steamdb links', () => {
    expect(parseAppId('https://steamcommunity.com/app/570')).toBe('570')
    expect(parseAppId('https://steamdb.info/app/570/')).toBe('570')
  })

  it('accepts a loose phrase', () => {
    expect(parseAppId('app 570')).toBe('570')
  })

  it('rejects empty and non-numeric input', () => {
    expect(parseAppId('')).toBeNull()
    expect(parseAppId('   ')).toBeNull()
    expect(parseAppId('no digits here at all, just words')).toBeNull()
  })

  it('does not scrape a number out of a long non-url string', () => {
    expect(parseAppId('this sentence has a 570 buried inside it somewhere')).toBeNull()
  })
})

describe('url builders', () => {
  it('builds the store page url', () => {
    expect(appUrl('570')).toBe('https://store.steampowered.com/app/570/')
  })

  it('builds cdn image urls from the app id and filename', () => {
    expect(imageUrl('570', 'header.jpg')).toBe(
      'https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg',
    )
  })

  it('names the download file with the app id and asset name', () => {
    expect(artworkFilename('570', 'header.jpg')).toBe('steam-570-header.jpg')
  })
})

describe('assets', () => {
  it('exposes every artwork file', () => {
    expect(ASSETS.map((asset) => asset.name)).toEqual(ARTWORK_FILENAMES)
  })

  it('looks up an asset by name', () => {
    expect(assetByName('header.jpg')?.label).toBe('Header')
    expect(assetByName('nope.jpg')).toBeUndefined()
  })

  it('keeps every asset within plausible store dimensions', () => {
    for (const asset of ASSETS) {
      expect(asset.width).toBeGreaterThan(100)
      expect(asset.height).toBeGreaterThan(100)
    }
  })
})
