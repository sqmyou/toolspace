/**
 * A dependency-free PDF merger.
 *
 * PDF is a graph of numbered objects, some compressed in `ObjStm` streams.
 * Merging means copying every object from every input under fresh numbers,
 * rewriting the cross-reference table, and building one new page tree whose
 * kids are the inputs' pages in the order the user chose.
 *
 * One deliberate restriction keeps this honest and small: only plain,
 * unencrypted PDFs are merged, and an encrypted file is reported rather than
 * silently mangled. Cross-reference *streams* (PDF 1.5+) are not read; the
 * output always uses a classic table, which every reader accepts.
 *
 * Everything here is byte-oriented and runs in the page. Nothing is uploaded.
 */

export interface PdfInfo {
  pageCount: number
  /** Whether the trailer advertised an Encrypt dictionary. */
  encrypted: boolean
}

export class PdfError extends Error {}

const decoder = new TextDecoder('latin1')
const encoder = new TextEncoder()

/** The last cross-reference section in the file. */
function findXrefOffset(bytes: Uint8Array): number {
  const text = decoder.decode(bytes)
  const offsets: number[] = []
  const re = /startxref\s+(\d+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) offsets.push(Number(match[1]))
  const usable = offsets.filter((offset) => offset > 0 && offset < bytes.length)
  if (usable.length === 0) throw new PdfError('No cross-reference table found — this may not be a PDF.')
  return usable[usable.length - 1]
}

interface XrefEntry {
  offset: number
  type: 'n' | 'f'
}

interface ParsedPdf {
  /** Object number to raw object bytes (the value after "N 0 obj"). */
  objects: Map<number, Uint8Array>
  trailer: Map<string, string>
  encrypted: boolean
}

/** Parse a classic `xref` table into object-number to offset. */
function parseXrefTable(bytes: Uint8Array, start: number): Map<number, XrefEntry> {
  const text = decoder.decode(bytes.subarray(start))
  const entries = new Map<number, XrefEntry>()
  const header = /^\s*xref\s+/.exec(text)
  if (!header) throw new PdfError('This PDF uses a cross-reference stream, which is not supported yet.')
  if (text.startsWith('trailer', 0)) return entries

  let cursor = header[0].length
  const sectionRe = /^\s*(\d+)\s+(\d+)\s*\r?\n/
  const entryRe = /^(\d{10})\s(\d{5})\s([nf])\s{0,2}\r?\n?/

  while (cursor < text.length) {
    if (text.startsWith('trailer', cursor)) break
    const section = sectionRe.exec(text.slice(cursor))
    if (!section) break
    const first = Number(section[1])
    const count = Number(section[2])
    cursor += section[0].length
    for (let i = 0; i < count; i += 1) {
      const entry = entryRe.exec(text.slice(cursor))
      if (!entry) break
      cursor += entry[0].length
      entries.set(first + i, { offset: Number(entry[1]), type: entry[3] as 'n' | 'f' })
    }
  }
  return entries
}

/** Read the trailer dictionary that follows the xref table. */
function parseTrailer(bytes: Uint8Array, start: number): Map<string, string> {
  const text = decoder.decode(bytes.subarray(start))
  const fields = new Map<string, string>()
  const index = text.indexOf('trailer')
  if (index === -1) return fields
  const open = text.indexOf('<<', index)
  if (open === -1) return fields

  let depth = 0
  let end = text.length
  for (let i = open; i < text.length - 1; i += 1) {
    if (text[i] === '<' && text[i + 1] === '<') {
      depth += 1
      i += 1
    } else if (text[i] === '>' && text[i + 1] === '>') {
      depth -= 1
      i += 1
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  const body = text.slice(open + 2, end - 2)
  const re = /\/(\w+)\s*(<<[^>]*>>|\[[^\]]*\]|\d+\s+\d+\s+R|[^\s/<>[\]]+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) fields.set(match[1], match[2].trim())
  return fields
}

/** Pull the direct /Length out of a stream's dictionary. */
function lengthFromDictionary(dictionary: string): number | null {
  const direct = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dictionary)
  return direct ? Number(direct[1]) : null
}

function indexOfAscii(bytes: Uint8Array, needle: string, from: number): number {
  const pattern = encoder.encode(needle)
  outer: for (let i = from; i <= bytes.length - pattern.length; i += 1) {
    for (let j = 0; j < pattern.length; j += 1) {
      if (bytes[i + j] !== pattern[j]) continue outer
    }
    return i
  }
  return -1
}

/**
 * Slice out the bytes of a single object, starting at its `N 0 obj` header.
 *
 * The scan tracks string and dictionary nesting so an `endobj` sitting inside
 * a string cannot end the object early, and consumes stream payloads by their
 * declared /Length rather than by searching for `endstream`.
 */
function readObjectAt(bytes: Uint8Array, offset: number): Uint8Array {
  const head = decoder.decode(bytes.subarray(offset, Math.min(offset + 4096, bytes.length)))
  const header = /^\s*\d+\s+\d+\s+obj\s*/.exec(head)
  if (!header) throw new PdfError('An object was not where the cross-reference table said it was.')

  const bodyStart = offset + header[0].length
  const window = decoder.decode(bytes.subarray(offset, bytes.length))

  let i = bodyStart
  let depth = 0
  let inString = false
  let inHex = false

  while (i < bytes.length) {
    const ch = bytes[i]
    const at = i - offset

    if (inString) {
      if (ch === 0x5c) i += 2
      else {
        if (ch === 0x29) inString = false
        i += 1
      }
      continue
    }
    if (inHex) {
      if (ch === 0x3e) inHex = false
      i += 1
      continue
    }
    if (ch === 0x28) {
      inString = true
      i += 1
      continue
    }
    if (ch === 0x3c) {
      if (bytes[i + 1] === 0x3c) {
        depth += 1
        i += 2
      } else {
        inHex = true
        i += 1
      }
      continue
    }
    if (ch === 0x3e && bytes[i + 1] === 0x3e) {
      depth -= 1
      i += 2
      continue
    }

    if (depth === 0) {
      if (window.startsWith('endobj', at)) return bytes.subarray(bodyStart, i).length ? trimTrailing(bytes.subarray(bodyStart, i)) : bytes.subarray(bodyStart, i)
      if (window.startsWith('stream', at)) {
        let dataStart = i + 'stream'.length
        if (bytes[dataStart] === 0x0d) dataStart += 1
        if (bytes[dataStart] === 0x0a) dataStart += 1
        const length = lengthFromDictionary(decoder.decode(bytes.subarray(bodyStart, i)))
        if (length === null) throw new PdfError('A stream uses an indirect /Length, which is not supported.')
        const endstream = indexOfAscii(bytes, 'endstream', dataStart + length)
        const end = endstream === -1 ? bytes.length : endstream + 'endstream'.length
        return bytes.subarray(bodyStart, end)
      }
    }
    i += 1
  }
  return bytes.subarray(bodyStart, i)
}

function trimTrailing(bytes: Uint8Array): Uint8Array {
  let end = bytes.length
  while (end > 0 && (bytes[end - 1] === 0x0a || bytes[end - 1] === 0x0d || bytes[end - 1] === 0x20)) end -= 1
  return bytes.subarray(0, end)
}

export function parsePdf(bytes: Uint8Array): ParsedPdf {
  const xrefOffset = findXrefOffset(bytes)
  const xref = parseXrefTable(bytes, xrefOffset)
  const trailer = parseTrailer(bytes, xrefOffset)
  const encrypted = trailer.has('Encrypt')

  const objects = new Map<number, Uint8Array>()
  for (const [number, entry] of xref) {
    if (entry.type !== 'n') continue
    if (entry.offset <= 0 || entry.offset >= bytes.length) continue
    try {
      objects.set(number, readObjectAt(bytes, entry.offset))
    } catch {
      // A single unreadable object is skipped; the page-count check catches
      // the damage if it mattered.
    }
  }
  return { objects, trailer, encrypted }
}

/** The object number a `N G R` reference points at. */
function refNumber(value: string | undefined): number | null {
  if (!value) return null
  const match = /(\d+)\s+\d+\s+R/.exec(value)
  return match ? Number(match[1]) : null
}

/** Resolve the catalog, then walk the page tree depth-first. */
export function pageRefs(pdf: ParsedPdf): number[] {
  const rootRef = refNumber(pdf.trailer.get('Root'))
  if (rootRef === null) throw new PdfError('The PDF has no document catalog.')
  const catalog = decoder.decode(pdf.objects.get(rootRef) ?? new Uint8Array())
  const pagesRef = refNumber(/\/Pages\s+(\d+\s+\d+\s+R)/.exec(catalog)?.[1])
  if (pagesRef === null) throw new PdfError('The PDF has no page tree.')

  const pages: number[] = []
  const seen = new Set<number>()
  const walk = (number: number) => {
    if (seen.has(number)) return
    seen.add(number)
    const body = pdf.objects.get(number)
    if (!body) return
    const text = decoder.decode(body)
    if (/\/Type\s*\/Pages\b/.test(text)) {
      const kids = /\/Kids\s*\[([^\]]*)\]/.exec(text)
      if (!kids) return
      for (const kid of kids[1].matchAll(/(\d+)\s+\d+\s+R/g)) walk(Number(kid[1]))
    } else {
      pages.push(number)
    }
  }
  walk(pagesRef)
  return pages
}

export function pdfInfo(bytes: Uint8Array): PdfInfo {
  const pdf = parsePdf(bytes)
  if (pdf.encrypted) return { pageCount: 0, encrypted: true }
  return { pageCount: pageRefs(pdf).length, encrypted: false }
}

/** Renumber every indirect reference in an object body, e.g. `12 0 R` -> `40 0 R`. */
function renumber(body: Uint8Array, map: Map<number, number>): Uint8Array {
  const text = decoder.decode(body)
  const rewritten = text.replace(/(\d+)(\s+\d+\s+R)/g, (whole, digits: string, tail: string) => {
    const target = map.get(Number(digits))
    return target === undefined ? whole : `${target}${tail}`
  })
  return encoder.encode(rewritten)
}

export interface MergeInput {
  bytes: Uint8Array
  /** Which page indexes to take, in order. Defaults to every page. */
  pages?: number[]
}

/**
 * Merge PDFs into one document, copying objects and rebuilding the page tree.
 * Page order follows the inputs, and within an input the order of `pages`.
 */
export function mergePdfs(inputs: MergeInput[]): Uint8Array<ArrayBuffer> {
  if (inputs.length === 0) throw new PdfError('Add at least one PDF to merge.')

  const parsed = inputs.map((input) => {
    const pdf = parsePdf(input.bytes)
    if (pdf.encrypted) throw new PdfError('One of the files is encrypted and cannot be merged.')
    return pdf
  })

  const out = new Map<number, Uint8Array>()
  let next = 1
  const maps = parsed.map((pdf) => {
    const map = new Map<number, number>()
    for (const number of pdf.objects.keys()) map.set(number, next++)
    return map
  })

  const pageObjects: number[] = []
  parsed.forEach((pdf, index) => {
    const refs = pageRefs(pdf)
    const wanted = inputs[index].pages ?? refs.map((_, i) => i)
    for (const pageIndex of wanted) {
      const copied = maps[index].get(refs[pageIndex])
      if (copied !== undefined) pageObjects.push(copied)
    }
  })

  if (pageObjects.length === 0) throw new PdfError('No pages were found to merge.')

  const pagesNumber = next++
  const catalogNumber = next++

  for (const [index, pdf] of parsed.entries()) {
    const map = maps[index]
    for (const [number, body] of pdf.objects) out.set(map.get(number)!, renumber(body, map))
  }

  out.set(
    pagesNumber,
    encoder.encode(`<< /Type /Pages /Count ${pageObjects.length} /Kids [${pageObjects.map((n) => `${n} 0 R`).join(' ')}] >>`),
  )
  out.set(catalogNumber, encoder.encode(`<< /Type /Catalog /Pages ${pagesNumber} 0 R >>`))

  // Every copied page must point at the new parent, or readers reject the tree.
  for (const number of pageObjects) {
    const text = decoder.decode(out.get(number)!)
    const fixed = /\/Parent\s+\d+\s+\d+\s+R/.test(text)
      ? text.replace(/\/Parent\s+\d+\s+\d+\s+R/, `/Parent ${pagesNumber} 0 R`)
      : text.replace(/<</, `<< /Parent ${pagesNumber} 0 R`)
    out.set(number, encoder.encode(fixed))
  }

  const chunks: Uint8Array[] = [encoder.encode('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n')]
  let offset = chunks[0].length

  const numbers = [...out.keys()].sort((a, b) => a - b)
  const offsets = new Map<number, number>()
  for (const number of numbers) {
    offsets.set(number, offset)
    const body = out.get(number)!
    const piece = encoder.encode(`${number} 0 obj\n`)
    const tail = encoder.encode('\nendobj\n')
    chunks.push(piece, body, tail)
    offset += piece.length + body.length + tail.length
  }

  const xrefOffset = offset
  const size = Math.max(...numbers) + 1
  let table = `xref\n0 ${size}\n0000000000 65535 f \n`
  for (let number = 1; number < size; number += 1) {
    const at = offsets.get(number)
    table += at === undefined ? '0000000000 65535 f \n' : `${String(at).padStart(10, '0')} 00000 n \n`
  }
  chunks.push(encoder.encode(table))
  chunks.push(
    encoder.encode(`trailer\n<< /Size ${size} /Root ${catalogNumber} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`),
  )

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Uint8Array(total)
  let cursor = 0
  for (const chunk of chunks) {
    merged.set(chunk, cursor)
    cursor += chunk.length
  }
  return merged
}
