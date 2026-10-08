import { describe, expect, it } from 'vitest'
import { mergePdfs, pageRefs, parsePdf, pdfInfo, PdfError } from './pdf'
import { makePdf } from './test-fixtures'

/**
 * Walk the merged page tree and pull the `PAGE-n` marker out of each page's
 * content stream, in page order. This is what a reader would actually see.
 */
function pageTexts(bytes: Uint8Array): string[] {
  const pdf = parsePdf(bytes)
  const text = new TextDecoder('latin1').decode(bytes)
  return pageRefs(pdf).map((number) => {
    const page = new RegExp(`${number} 0 obj([\\s\\S]*?)endobj`).exec(text)!
    const contents = /\/Contents\s+(\d+)\s+0\s+R/.exec(page[1])!
    const stream = new RegExp(`${contents[1]} 0 obj([\\s\\S]*?)endobj`).exec(text)!
    return /\((PAGE-\d+)\)/.exec(stream[1])![1]
  })
}

describe('pdfInfo', () => {
  it('counts the pages of a single-page file', () => {
    expect(pdfInfo(makePdf([1]))).toEqual({ pageCount: 1, encrypted: false })
  })

  it('counts the pages of a multi-page file', () => {
    expect(pdfInfo(makePdf([1, 2, 3]))).toEqual({ pageCount: 3, encrypted: false })
  })

  it('reports an encrypted file rather than pretending it can read it', () => {
    expect(pdfInfo(makePdf([1], { encrypt: true })).encrypted).toBe(true)
  })

  it('rejects something that is not a PDF', () => {
    expect(() => pdfInfo(new TextEncoder().encode('just some text'))).toThrow(PdfError)
  })

  it('explains itself when the file uses a cross-reference stream', () => {
    // A PDF 1.5+ file whose startxref points at an /XRef object rather than a
    // classic table. We do not read these, but the message must say so.
    const body = '%PDF-1.5\n1 0 obj\n<< /Type /XRef /Size 2 >>\nendobj\nstartxref\n9\n%%EOF\n'
    const bytes = new TextEncoder().encode(body)
    expect(() => pdfInfo(bytes)).toThrow(/cross-reference stream/i)
  })
})

describe('mergePdfs', () => {
  it('merges two documents and sums their pages', () => {
    const merged = mergePdfs([{ bytes: makePdf([1, 2]) }, { bytes: makePdf([3, 4, 5]) }])
    expect(pdfInfo(merged)).toEqual({ pageCount: 5, encrypted: false })
  })

  it('preserves input order', () => {
    const merged = mergePdfs([{ bytes: makePdf([1]) }, { bytes: makePdf([2]) }])
    expect(pageTexts(merged)).toEqual(['PAGE-1', 'PAGE-2'])
  })

  it('keeps pages in order when the same file is merged twice', () => {
    const one = makePdf([1, 2])
    const merged = mergePdfs([{ bytes: one }, { bytes: one }])
    expect(pdfInfo(merged).pageCount).toBe(4)
    expect(pageTexts(merged)).toEqual(['PAGE-1', 'PAGE-2', 'PAGE-1', 'PAGE-2'])
  })

  it('merges a single document unchanged in page count', () => {
    expect(pdfInfo(mergePdfs([{ bytes: makePdf([1, 2, 3]) }])).pageCount).toBe(3)
  })

  it('takes only the requested pages, in the requested order', () => {
    const merged = mergePdfs([{ bytes: makePdf([1, 2, 3]), pages: [2, 0] }])
    expect(pdfInfo(merged).pageCount).toBe(2)
    // Read the page tree, not the byte order: objects are written in numeric
    // order, so position in the file says nothing about page order.
    expect(pageTexts(merged)).toEqual(['PAGE-3', 'PAGE-1'])
  })

  it('renumbers objects so the two inputs cannot collide', () => {
    const merged = mergePdfs([{ bytes: makePdf([1, 2]) }, { bytes: makePdf([3, 4]) }])
    const text = new TextDecoder('latin1').decode(merged)
    const objects = [...text.matchAll(/^(\d+) 0 obj/gm)].map((m) => Number(m[1]))
    expect(new Set(objects).size).toBe(objects.length)
  })

  it('writes a readable cross-reference table', () => {
    const merged = mergePdfs([{ bytes: makePdf([1]) }, { bytes: makePdf([2]) }])
    const text = new TextDecoder('latin1').decode(merged)
    const declared = /startxref\s+(\d+)/.exec(text)!
    expect(text.slice(Number(declared[1]), Number(declared[1]) + 4)).toBe('xref')
  })

  it('points every page at the new parent', () => {
    const merged = mergePdfs([{ bytes: makePdf([1, 2]) }, { bytes: makePdf([3]) }])
    const text = new TextDecoder('latin1').decode(merged)
    const kids = /\/Type\s*\/Pages\s*\/Count\s*3\s*\/Kids\s*\[([^\]]*)\]/.exec(text)
    expect(kids).not.toBeNull()
    for (const kid of kids![1].matchAll(/(\d+) 0 R/g)) {
      const page = new RegExp(`${kid[1]} 0 obj([\\s\\S]*?)endobj`).exec(text)!
      expect(page[1]).toMatch(/\/Parent\s+\d+\s+0\s+R/)
    }
  })

  it('remaps shared resources such as fonts to the copied object', () => {
    // Both inputs reference a font as object 3; after merging the second
    // input's font lives at a new number and the page must point there, not
    // back at the first input's font.
    const merged = mergePdfs([
      { bytes: makePdf([1], { font: true }) },
      { bytes: makePdf([2], { font: true }) },
    ])
    const text = new TextDecoder('latin1').decode(merged)
    const fontRefs = [...text.matchAll(/\/Font\s*<<\s*\/F1\s+(\d+)\s+0\s+R/g)].map((m) => Number(m[1]))
    expect(fontRefs).toHaveLength(2)
    expect(fontRefs[0]).not.toBe(fontRefs[1])
    for (const ref of fontRefs) {
      expect(new RegExp(`${ref} 0 obj\\s*<< /Type /Font`).test(text)).toBe(true)
    }
  })

  it('refuses an encrypted input', () => {
    expect(() => mergePdfs([{ bytes: makePdf([1], { encrypt: true }) }])).toThrow(/encrypted/i)
  })

  it('refuses an empty list', () => {
    expect(() => mergePdfs([])).toThrow(PdfError)
  })
})
