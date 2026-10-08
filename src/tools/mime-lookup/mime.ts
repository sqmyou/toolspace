/** Extension ↔ MIME type lookup over a curated common-types table. */

export interface MimeEntry {
  type: string
  extensions: string[]
}

export const MIME_TABLE: MimeEntry[] = [
  { type: 'application/json', extensions: ['json', 'map'] },
  { type: 'application/ld+json', extensions: ['jsonld'] },
  { type: 'application/xml', extensions: ['xml', 'xsl', 'xsd', 'rss', 'atom'] },
  { type: 'application/pdf', extensions: ['pdf'] },
  { type: 'application/zip', extensions: ['zip'] },
  { type: 'application/gzip', extensions: ['gz', 'tgz'] },
  { type: 'application/x-tar', extensions: ['tar'] },
  { type: 'application/x-7z-compressed', extensions: ['7z'] },
  { type: 'application/x-rar-compressed', extensions: ['rar'] },
  { type: 'application/vnd.rar', extensions: ['rar'] },
  { type: 'application/javascript', extensions: ['js', 'mjs', 'cjs'] },
  { type: 'application/typescript', extensions: ['ts', 'mts', 'cts'] },
  { type: 'application/wasm', extensions: ['wasm'] },
  { type: 'application/octet-stream', extensions: ['bin', 'exe', 'dll', 'so', 'dmg', 'iso'] },
  { type: 'application/x-httpd-php', extensions: ['php'] },
  { type: 'application/x-sh', extensions: ['sh', 'bash'] },
  { type: 'application/sql', extensions: ['sql'] },
  { type: 'application/rtf', extensions: ['rtf'] },
  { type: 'application/msword', extensions: ['doc'] },
  { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensions: ['docx'] },
  { type: 'application/vnd.ms-excel', extensions: ['xls'] },
  { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extensions: ['xlsx'] },
  { type: 'application/vnd.ms-powerpoint', extensions: ['ppt'] },
  { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extensions: ['pptx'] },
  { type: 'application/epub+zip', extensions: ['epub'] },
  { type: 'application/vnd.apple.installer+xml', extensions: ['mpkg'] },
  { type: 'application/x-msdownload', extensions: ['msi'] },
  { type: 'application/x-font-ttf', extensions: ['ttf'] },
  { type: 'font/otf', extensions: ['otf'] },
  { type: 'font/woff', extensions: ['woff'] },
  { type: 'font/woff2', extensions: ['woff2'] },
  { type: 'image/jpeg', extensions: ['jpg', 'jpeg', 'jpe'] },
  { type: 'image/png', extensions: ['png'] },
  { type: 'image/gif', extensions: ['gif'] },
  { type: 'image/webp', extensions: ['webp'] },
  { type: 'image/avif', extensions: ['avif'] },
  { type: 'image/svg+xml', extensions: ['svg'] },
  { type: 'image/bmp', extensions: ['bmp'] },
  { type: 'image/tiff', extensions: ['tif', 'tiff'] },
  { type: 'image/x-icon', extensions: ['ico'] },
  { type: 'image/heic', extensions: ['heic'] },
  { type: 'image/heif', extensions: ['heif'] },
  { type: 'audio/mpeg', extensions: ['mp3'] },
  { type: 'audio/ogg', extensions: ['ogg', 'oga'] },
  { type: 'audio/wav', extensions: ['wav'] },
  { type: 'audio/flac', extensions: ['flac'] },
  { type: 'audio/aac', extensions: ['aac'] },
  { type: 'audio/mp4', extensions: ['m4a'] },
  { type: 'audio/webm', extensions: ['weba'] },
  { type: 'video/mp4', extensions: ['mp4', 'm4v'] },
  { type: 'video/webm', extensions: ['webm'] },
  { type: 'video/ogg', extensions: ['ogv'] },
  { type: 'video/quicktime', extensions: ['mov'] },
  { type: 'video/x-msvideo', extensions: ['avi'] },
  { type: 'video/mpeg', extensions: ['mpeg', 'mpg'] },
  { type: 'video/x-matroska', extensions: ['mkv'] },
  { type: 'text/plain', extensions: ['txt', 'text', 'log', 'ini', 'conf', 'cfg'] },
  { type: 'text/html', extensions: ['html', 'htm'] },
  { type: 'text/css', extensions: ['css'] },
  { type: 'text/csv', extensions: ['csv'] },
  { type: 'text/tab-separated-values', extensions: ['tsv'] },
  { type: 'text/markdown', extensions: ['md', 'markdown'] },
  { type: 'text/calendar', extensions: ['ics'] },
  { type: 'text/vcard', extensions: ['vcf'] },
  { type: 'text/yaml', extensions: ['yaml', 'yml'] },
  { type: 'application/x-yaml', extensions: ['yaml', 'yml'] },
  { type: 'application/toml', extensions: ['toml'] },
  { type: 'message/rfc822', extensions: ['eml', 'mime'] },
  { type: 'multipart/form-data', extensions: [] },
  { type: 'application/x-www-form-urlencoded', extensions: [] },
]

const byExtension = new Map<string, string>()
for (const entry of MIME_TABLE) {
  for (const extension of entry.extensions) {
    if (!byExtension.has(extension)) byExtension.set(extension, entry.type)
  }
}

export function extensionOf(filename: string): string {
  const clean = filename.trim().toLowerCase().split(/[?#]/)[0]
  const base = clean.slice(clean.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot + 1)
}

export interface LookupResult {
  extension: string
  mime: string
  known: boolean
}

export function lookupByFilename(filename: string): LookupResult {
  const extension = extensionOf(filename)
  const mime = extension ? byExtension.get(extension) : undefined
  return { extension, mime: mime ?? (extension ? 'application/octet-stream' : ''), known: Boolean(mime) }
}

export function lookupByType(mime: string): string[] {
  const clean = mime.trim().toLowerCase()
  const exact = MIME_TABLE.find((entry) => entry.type === clean)
  return exact ? [...exact.extensions] : []
}

/** Free-text search across both directions, for the browse list. */
export function searchMime(query: string): MimeEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return MIME_TABLE
  return MIME_TABLE.filter(
    (entry) => entry.type.includes(q) || entry.extensions.some((extension) => extension.includes(q)),
  )
}

export function isImage(type: string): boolean {
  return type.startsWith('image/')
}

export function isTextual(type: string): boolean {
  return type.startsWith('text/') || type.includes('json') || type.includes('xml') || type.includes('yaml') || type.includes('javascript')
}
