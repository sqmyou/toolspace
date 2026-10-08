/**
 * Minimal PDF writer used only by the tests, so the merger can be exercised
 * against files whose bytes we control. Each page gets a content stream
 * containing `PAGE-<n>` so ordering assertions have something to look for.
 */
export interface FixtureOptions {
  encrypt?: boolean
  /** Add a shared font object referenced from every page's resources. */
  font?: boolean
}

export function makePdf(pages: number[], options: FixtureOptions = {}): Uint8Array {
  const objects: string[] = []
  const pageObjectNumbers: number[] = []

  // 1 = catalog, 2 = pages, 3 = font (when asked for), then two objects per
  // page (the page itself, then its content stream).
  const firstPage = options.font ? 4 : 3
  for (let i = 0; i < pages.length; i += 1) pageObjectNumbers.push(firstPage + i * 2)

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers
    .map((n) => `${n} 0 R`)
    .join(' ')}] >>`
  if (options.font) objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'

  const resources = options.font ? '<< /Font << /F1 3 0 R >> >>' : '<< >>'

  pages.forEach((label, index) => {
    const pageNumber = firstPage + index * 2
    const contentNumber = pageNumber + 1
    objects[pageNumber] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources ${resources} /Contents ${contentNumber} 0 R >>`
    const stream = `BT /F1 12 Tf 20 100 Td (PAGE-${label}) Tj ET`
    objects[contentNumber] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  })

  const chunks: string[] = ['%PDF-1.4\n%\xe2\xe3\xcf\xd3\n']
  let offset = chunks[0].length
  const offsets: number[] = []

  const max = objects.length - 1
  for (let number = 1; number <= max; number += 1) {
    const body = objects[number]
    if (body === undefined) continue
    offsets[number] = offset
    const piece = `${number} 0 obj\n${body}\nendobj\n`
    chunks.push(piece)
    offset += piece.length
  }

  const xrefOffset = offset
  let table = `xref\n0 ${max + 1}\n0000000000 65535 f \n`
  for (let number = 1; number <= max; number += 1) {
    table +=
      offsets[number] === undefined
        ? '0000000000 65535 f \n'
        : `${String(offsets[number]).padStart(10, '0')} 00000 n \n`
  }
  chunks.push(table)

  const encrypt = options.encrypt ? ' /Encrypt 99 0 R' : ''
  chunks.push(`trailer\n<< /Size ${max + 1} /Root 1 0 R${encrypt} >>\nstartxref\n${xrefOffset}\n%%EOF\n`)

  const text = chunks.join('')
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff
  return bytes
}
