/** A pragmatic user-agent string parser covering the common browsers and bots. */

export interface UserAgentInfo {
  browser: string
  browserVersion: string
  engine: string
  os: string
  osVersion: string
  device: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
  bot: boolean
}

function matchVersion(input: string, pattern: RegExp): string {
  const match = input.match(pattern)
  return match?.[1]?.replace(/_/g, '.') ?? ''
}

export function parseUserAgent(input: string): UserAgentInfo {
  const ua = input.trim()
  if (!ua) {
    return { browser: 'Unknown', browserVersion: '', engine: 'Unknown', os: 'Unknown', osVersion: '', device: 'unknown', bot: false }
  }

  const bot = /bot|crawler|spider|crawling|slurp|bingpreview|headless/i.test(ua)

  let browser = 'Unknown'
  let browserVersion = ''

  // Order matters: Edge and Opera impersonate Chrome, Chrome impersonates Safari.
  if (/Edg(?:e|A|iOS)?\//.test(ua)) {
    browser = 'Edge'
    browserVersion = matchVersion(ua, /Edg(?:e|A|iOS)?\/([\d.]+)/)
  } else if (/OPR\/|Opera/.test(ua)) {
    browser = 'Opera'
    browserVersion = matchVersion(ua, /(?:OPR|Opera)[/ ]([\d.]+)/)
  } else if (/SamsungBrowser/.test(ua)) {
    browser = 'Samsung Internet'
    browserVersion = matchVersion(ua, /SamsungBrowser\/([\d.]+)/)
  } else if (/Firefox\/|FxiOS/.test(ua)) {
    browser = 'Firefox'
    browserVersion = matchVersion(ua, /(?:Firefox|FxiOS)\/([\d.]+)/)
  } else if (/Chrome\/|CriOS/.test(ua)) {
    browser = 'Chrome'
    browserVersion = matchVersion(ua, /(?:Chrome|CriOS)\/([\d.]+)/)
  } else if (/Version\/[\d.]+.*Safari/.test(ua)) {
    browser = 'Safari'
    browserVersion = matchVersion(ua, /Version\/([\d.]+)/)
  } else if (/bot|crawler|spider/i.test(ua)) {
    // Fall through to the bot branch below.
    browser = ua.split('/')[0].split(' ')[0]
  }

  let engine = 'Unknown'
  if (/Gecko\/|Firefox/.test(ua) && !/like Gecko/.test(ua)) engine = 'Gecko'
  else if (/AppleWebKit/.test(ua) && /Chrome|Chromium|Edg/.test(ua)) engine = 'Blink'
  else if (/AppleWebKit/.test(ua)) engine = 'WebKit'
  else if (/MSIE|Trident/.test(ua)) engine = 'Trident'
  else if (/Gecko/.test(ua)) engine = 'Gecko'

  let os = 'Unknown'
  let osVersion = ''
  if (/Windows NT/.test(ua)) {
    os = 'Windows'
    const nt = matchVersion(ua, /Windows NT ([\d.]+)/)
    osVersion = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' }[nt] ?? nt
  } else if (/Android/.test(ua)) {
    os = 'Android'
    osVersion = matchVersion(ua, /Android ([\d.]+)/)
  } else if (/(?:iPhone|iPad|iPod)/.test(ua)) {
    os = 'iOS'
    osVersion = matchVersion(ua, /OS ([\d_]+)/)
  } else if (/Mac OS X/.test(ua)) {
    os = 'macOS'
    osVersion = matchVersion(ua, /Mac OS X ([\d_.]+)/)
  } else if (/CrOS/.test(ua)) {
    os = 'ChromeOS'
  } else if (/Linux/.test(ua)) {
    os = 'Linux'
  }

  let device: UserAgentInfo['device'] = 'desktop'
  if (bot) device = 'bot'
  else if (/iPad|Tablet|Nexus 7|Nexus 10/.test(ua)) device = 'tablet'
  else if (/Mobi|iPhone|Android.*Mobile/.test(ua)) device = 'mobile'
  else if (!os || os === 'Unknown') device = 'unknown'

  return { browser, browserVersion, engine, os, osVersion, device, bot }
}

/** Sample strings so the tool is useful without the visitor having to find one. */
export const SAMPLES: { label: string; ua: string }[] = [
  {
    label: 'Chrome on Windows',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
  {
    label: 'Safari on iPhone',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  },
  {
    label: 'Firefox on Linux',
    ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  },
  {
    label: 'Edge on Windows',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.67',
  },
  {
    label: 'Googlebot',
    ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  },
]
