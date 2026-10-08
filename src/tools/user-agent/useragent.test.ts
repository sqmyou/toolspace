import { describe, expect, it } from 'vitest'
import { parseUserAgent, SAMPLES } from './useragent'

const sample = (label: string) => SAMPLES.find((entry) => entry.label === label)!.ua

describe('parseUserAgent', () => {
  it('detects Chrome on Windows', () => {
    const info = parseUserAgent(sample('Chrome on Windows'))
    expect(info.browser).toBe('Chrome')
    expect(info.browserVersion.startsWith('124')).toBe(true)
    expect(info.engine).toBe('Blink')
    expect(info.os).toBe('Windows')
    expect(info.osVersion).toBe('10/11')
    expect(info.device).toBe('desktop')
  })

  it('detects Safari on iPhone with a dotted OS version', () => {
    const info = parseUserAgent(sample('Safari on iPhone'))
    expect(info.browser).toBe('Safari')
    expect(info.os).toBe('iOS')
    expect(info.osVersion).toBe('17.4')
    expect(info.engine).toBe('WebKit')
    expect(info.device).toBe('mobile')
  })

  it('detects Firefox on Linux with the Gecko engine', () => {
    const info = parseUserAgent(sample('Firefox on Linux'))
    expect(info.browser).toBe('Firefox')
    expect(info.engine).toBe('Gecko')
    expect(info.os).toBe('Linux')
  })

  it('prefers Edge over Chrome', () => {
    const info = parseUserAgent(sample('Edge on Windows'))
    expect(info.browser).toBe('Edge')
    expect(info.browserVersion.startsWith('124')).toBe(true)
  })

  it('detects bots', () => {
    const info = parseUserAgent(sample('Googlebot'))
    expect(info.bot).toBe(true)
    expect(info.device).toBe('bot')
  })

  it('handles empty input', () => {
    const info = parseUserAgent('')
    expect(info.device).toBe('unknown')
    expect(info.bot).toBe(false)
  })
})
