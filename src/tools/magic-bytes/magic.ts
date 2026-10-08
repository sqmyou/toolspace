/**
 * File type detection from leading bytes.
 *
 * A signature is a byte pattern at a fixed offset, with -1 acting as a
 * wildcard so container formats like RIFF can share a prefix. Detection
 * returns every match rather than the first, because several formats overlap
 * and the caller can decide which one is plausible.
 */

export interface Signature {
  name: string
  mime: string
  extension: string
  /** Offset of the first byte of the pattern. */
  at: number
  /** Expected bytes; -1 matches anything. */
  bytes: number[]
  /** An extra pattern that must also match, for container formats. */
  also?: { at: number; bytes: number[] }
  /** Set for text formats that are detected by prefix rather than bytes. */
  text?: boolean
}

export interface Match {
  name: string
  mime: string
  extension: string
  /** How many bytes the signature pinned down; longer is more specific. */
  confidence: number
}

export const SIGNATURES: Signature[] = [
  { name: 'PNG image', mime: 'image/png', extension: 'png', at: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { name: 'JPEG image', mime: 'image/jpeg', extension: 'jpg', at: 0, bytes: [0xff, 0xd8, 0xff] },
  { name: 'GIF image', mime: 'image/gif', extension: 'gif', at: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  { name: 'BMP image', mime: 'image/bmp', extension: 'bmp', at: 0, bytes: [0x42, 0x4d] },
  { name: 'TIFF image (little endian)', mime: 'image/tiff', extension: 'tiff', at: 0, bytes: [0x49, 0x49, 0x2a, 0x00] },
  { name: 'TIFF image (big endian)', mime: 'image/tiff', extension: 'tiff', at: 0, bytes: [0x4d, 0x4d, 0x00, 0x2a] },
  { name: 'ICO icon', mime: 'image/x-icon', extension: 'ico', at: 0, bytes: [0x00, 0x00, 0x01, 0x00] },
  { name: 'WebP image', mime: 'image/webp', extension: 'webp', at: 0, bytes: [0x52, 0x49, 0x46, 0x46, -1, -1, -1, -1, 0x57, 0x45, 0x42, 0x50] },
  { name: 'WAV audio', mime: 'audio/wav', extension: 'wav', at: 0, bytes: [0x52, 0x49, 0x46, 0x46, -1, -1, -1, -1, 0x57, 0x41, 0x56, 0x45] },
  { name: 'AVI video', mime: 'video/x-msvideo', extension: 'avi', at: 0, bytes: [0x52, 0x49, 0x46, 0x46, -1, -1, -1, -1, 0x41, 0x56, 0x49, 0x20] },
  { name: 'PDF document', mime: 'application/pdf', extension: 'pdf', at: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  { name: 'ZIP archive', mime: 'application/zip', extension: 'zip', at: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  { name: 'ZIP archive (empty)', mime: 'application/zip', extension: 'zip', at: 0, bytes: [0x50, 0x4b, 0x05, 0x06] },
  { name: 'GZIP archive', mime: 'application/gzip', extension: 'gz', at: 0, bytes: [0x1f, 0x8b] },
  { name: 'BZIP2 archive', mime: 'application/x-bzip2', extension: 'bz2', at: 0, bytes: [0x42, 0x5a, 0x68] },
  { name: 'XZ archive', mime: 'application/x-xz', extension: 'xz', at: 0, bytes: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00] },
  { name: '7-Zip archive', mime: 'application/x-7z-compressed', extension: '7z', at: 0, bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { name: 'RAR archive', mime: 'application/vnd.rar', extension: 'rar', at: 0, bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] },
  { name: 'Zstandard archive', mime: 'application/zstd', extension: 'zst', at: 0, bytes: [0x28, 0xb5, 0x2f, 0xfd] },
  { name: 'LZ4 archive', mime: 'application/x-lz4', extension: 'lz4', at: 0, bytes: [0x04, 0x22, 0x4d, 0x18] },
  { name: 'TAR archive', mime: 'application/x-tar', extension: 'tar', at: 257, bytes: [0x75, 0x73, 0x74, 0x61, 0x72] },
  { name: 'ELF binary', mime: 'application/x-executable', extension: '', at: 0, bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { name: 'Windows executable', mime: 'application/vnd.microsoft.portable-executable', extension: 'exe', at: 0, bytes: [0x4d, 0x5a] },
  { name: 'Java class', mime: 'application/java-vm', extension: 'class', at: 0, bytes: [0xca, 0xfe, 0xba, 0xbe] },
  { name: 'SQLite database', mime: 'application/vnd.sqlite3', extension: 'sqlite', at: 0, bytes: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00] },
  { name: 'Ogg media', mime: 'application/ogg', extension: 'ogg', at: 0, bytes: [0x4f, 0x67, 0x67, 0x53] },
  { name: 'FLAC audio', mime: 'audio/flac', extension: 'flac', at: 0, bytes: [0x66, 0x4c, 0x61, 0x43] },
  { name: 'Matroska / WebM', mime: 'video/x-matroska', extension: 'mkv', at: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] },
  { name: 'MP4 / ISO base media', mime: 'video/mp4', extension: 'mp4', at: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
  { name: 'MP3 audio (ID3)', mime: 'audio/mpeg', extension: 'mp3', at: 0, bytes: [0x49, 0x44, 0x33] },
  { name: 'WebAssembly module', mime: 'application/wasm', extension: 'wasm', at: 0, bytes: [0x00, 0x61, 0x73, 0x6d] },
  { name: 'Rich Text Format', mime: 'application/rtf', extension: 'rtf', at: 0, bytes: [0x7b, 0x5c, 0x72, 0x74, 0x66] },
  { name: 'PostScript', mime: 'application/postscript', extension: 'ps', at: 0, bytes: [0x25, 0x21, 0x50, 0x53] },
  { name: 'UTF-8 text with BOM', mime: 'text/plain', extension: 'txt', at: 0, bytes: [0xef, 0xbb, 0xbf], text: true },
  { name: 'UTF-16 text (little endian)', mime: 'text/plain', extension: 'txt', at: 0, bytes: [0xff, 0xfe], text: true },
  { name: 'UTF-16 text (big endian)', mime: 'text/plain', extension: 'txt', at: 0, bytes: [0xfe, 0xff], text: true },
]

function matchesAt(bytes: Uint8Array, at: number, pattern: number[]): boolean {
  if (at + pattern.length > bytes.length) return false
  return pattern.every((expected, index) => expected === -1 || bytes[at + index] === expected)
}

/** Every signature that matches the start of the buffer. */
export function detect(bytes: Uint8Array): Match[] {
  if (bytes.length === 0) return []
  const matches: Match[] = []
  for (const signature of SIGNATURES) {
    if (!matchesAt(bytes, signature.at, signature.bytes)) continue
    if (signature.also && !matchesAt(bytes, signature.also.at, signature.also.bytes)) continue
    matches.push({
      name: signature.name,
      mime: signature.mime,
      extension: signature.extension,
      confidence: signature.bytes.filter((value) => value !== -1).length,
    })
  }
  return matches.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name))
}

/** The single best guess, or null when nothing matched. */
export function detectOne(bytes: Uint8Array): Match | null {
  return detect(bytes)[0] ?? null
}

/** True when the buffer looks like printable text rather than binary. */
export function looksLikeText(bytes: Uint8Array, sampleSize = 512): boolean {
  const sample = bytes.subarray(0, sampleSize)
  if (sample.length === 0) return false
  let suspicious = 0
  for (const byte of sample) {
    if (byte === 0) return false
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) suspicious += 1
  }
  return suspicious / sample.length < 0.05
}

/** Read a hex string into bytes, ignoring spaces, commas and 0x prefixes. */
export function parseHex(text: string): Uint8Array {
  const cleaned = text.replace(/0x/gi, '').replace(/[\s,;:]+/g, '')
  if (cleaned.length === 0) return new Uint8Array()
  if (!/^[0-9a-f]+$/i.test(cleaned)) throw new Error('Hex input can only contain 0-9 and a-f')
  if (cleaned.length % 2 !== 0) throw new Error('Hex input needs an even number of digits')
  const bytes = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

/** Format bytes as the space-separated hex pairs used in the input box. */
export function toHex(bytes: Uint8Array, limit = 64): string {
  return [...bytes.subarray(0, limit)].map((byte) => byte.toString(16).padStart(2, '0')).join(' ')
}

/** Printable preview of the leading bytes, with non-printable bytes dotted. */
export function preview(bytes: Uint8Array, limit = 64): string {
  return [...bytes.subarray(0, limit)].map((byte) => (byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.')).join('')
}
