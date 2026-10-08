import { el } from './dom'

/** Copy that reflects success on the button itself, then restores its label. */
export function copyChip(value: string | (() => string), label?: string): HTMLButtonElement {
  const text = typeof value === 'function' ? value : () => value
  const button = el('button', {
    class: 'ts-copy-chip',
    type: 'button',
    title: 'Copy',
  }) as HTMLButtonElement
  const restore = label ?? text()
  button.textContent = restore
  button.addEventListener('click', async () => {
    const payload = text()
    try {
      await navigator.clipboard.writeText(payload)
      button.textContent = 'Copied'
      setTimeout(() => (button.textContent = restore), 900)
    } catch {
      /* clipboard blocked; value stays selectable */
    }
  })
  return button
}

/** A labelled row with a copy chip, matching the colour tool's output list. */
export function copyRow(label: string, value: string | (() => string)): HTMLElement {
  return el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, label), copyChip(value))
}

export function download(filename: string, data: string | Blob, type = 'text/plain'): void {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data
  const url = URL.createObjectURL(blob)
  const link = el('a', { href: url, download: filename })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Read a dropped/selected file as text. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}
