import { el } from './dom'
import { icon, iconEl, type IconName } from './icons'
import { download, readFileAsArrayBuffer, readFileAsText } from './ui'

/**
 * The shared component kit.
 *
 * Tools used to assemble the same six primitives by hand — a label + input,
 * a row of buttons, an output box with a copy chip, a file picker, a
 * two-column split — which is why so many pages read as raw form controls.
 * This module turns those into named parts so a new tool gets a polished,
 * consistent page by composing a handful of calls instead of re-deriving the
 * markup (and the responsive behaviour) every time.
 *
 * Everything here is DOM-only and dependency-free. Logic stays in the tool's
 * own pure module, as before.
 */

export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'

/* -------------------------------------------------------------------------
   Layout
   ------------------------------------------------------------------------- */

export interface ToolLayoutOptions {
  /** Wider column for tools that show side-by-side panes or tables. */
  wide?: boolean
}

/** The outer column every tool body should sit in. */
export function toolLayout(options: ToolLayoutOptions = {}, ...children: (Node | string)[]): HTMLElement {
  const root = el('div', { class: `ts-k-tool${options.wide ? ' ts-k-tool--wide' : ''}` })
  root.append(...children)
  return root
}

export interface PanelOptions {
  title?: string
  /** Small label on the right of the header, e.g. a count or format. */
  meta?: string
  icon?: IconName | string
  /** Let the body sit flush against the panel edges (tables, dropzones). */
  flush?: boolean
}

export type Panel = HTMLElement & { body: HTMLElement }

/**
 * A titled surface. Panels are the main way a tool page gets structure:
 * instead of one long column of loose controls, related things live in a
 * bounded card with a header.
 *
 * The returned element is the panel itself, so it can be passed straight to
 * `toolLayout`; its `body` is exposed for tools that need to fill it later.
 */
export function panel(options: PanelOptions = {}, ...children: (Node | string)[]): Panel {
  const body = el('div', { class: `ts-k-panel__body${options.flush ? ' ts-k-panel__body--flush' : ''}` })
  body.append(...children)
  const root = el('section', { class: 'ts-k-panel' }) as Panel
  if (options.title) {
    const head = el('header', { class: 'ts-k-panel__head' })
    if (options.icon) head.append(iconEl(options.icon, 15))
    head.append(el('h2', { class: 'ts-k-panel__title' }, options.title))
    if (options.meta) head.append(el('span', { class: 'ts-k-panel__meta' }, options.meta))
    root.append(head)
  }
  root.append(body)
  root.body = body
  return root
}

/** A labelled group with a heading rule, for long pages. */
export function section(title: string, ...children: (Node | string)[]): HTMLElement {
  return el('section', { class: 'ts-k-section' }, el('h3', { class: 'ts-k-section__title' }, title), ...children)
}

/** A responsive two-column split that collapses on narrow screens. */
export function split(...children: (Node | string)[]): HTMLElement {
  return el('div', { class: 'ts-k-split' }, ...children)
}

/** A responsive grid of equal-ish cards. */
export function grid(min = 180, ...children: (Node | string)[]): HTMLElement {
  return el('div', { class: 'ts-k-grid', style: `--ts-k-min:${min}px` }, ...children)
}

/** A horizontal toolbar that wraps on small screens. */
export function actions(...children: (Node | string)[]): HTMLElement {
  return el('div', { class: 'ts-k-actions' }, ...children)
}

/** Flexible spacer for pushing items apart in a row. */
export function spacer(): HTMLElement {
  return el('span', { class: 'ts-k-spacer' })
}

/* -------------------------------------------------------------------------
   Fields
   ------------------------------------------------------------------------- */

export interface FieldOptions {
  label?: string
  hint?: string
  /** Associate a label with a control by id, for screen readers. */
  forId?: string
  /** Stretch to fill a flex row. */
  grow?: boolean
}

/** Wrap a control with a label and an optional hint. */
export function field(control: Node, options: FieldOptions = {}): HTMLElement {
  const root = el('div', { class: `ts-k-field${options.grow ? ' ts-k-field--grow' : ''}` })
  if (options.label) {
    root.append(
      options.forId
        ? el('label', { class: 'ts-k-label', for: options.forId }, options.label)
        : el('span', { class: 'ts-k-label' }, options.label),
    )
  }
  root.append(control)
  if (options.hint) root.append(el('p', { class: 'ts-k-hint' }, options.hint))
  return root
}

export interface TextFieldOptions extends FieldOptions {
  value?: string
  placeholder?: string
  type?: string
  mono?: boolean
  readonly?: boolean
  spellcheck?: boolean
  onInput?: (value: string, event: Event) => void
  onChange?: (value: string, event: Event) => void
}

export function textField(options: TextFieldOptions = {}): HTMLInputElement {
  const input = el('input', {
    class: `ts-k-input${options.mono ? ' ts-k-mono' : ''}`,
    type: options.type ?? 'text',
    value: options.value ?? '',
    placeholder: options.placeholder ?? '',
    readonly: options.readonly ?? false,
    spellcheck: options.spellcheck ?? true,
  }) as HTMLInputElement
  if (options.onInput) input.addEventListener('input', (event) => options.onInput!(input.value, event))
  if (options.onChange) input.addEventListener('change', (event) => options.onChange!(input.value, event))
  return input
}

export interface TextareaOptions extends FieldOptions {
  value?: string
  placeholder?: string
  rows?: number
  readonly?: boolean
  mono?: boolean
  onInput?: (value: string, event: Event) => void
}

export function textarea(options: TextareaOptions = {}): HTMLTextAreaElement {
  const area = el('textarea', {
    class: `ts-k-textarea${options.mono === false ? '' : ' ts-k-mono'}`,
    rows: options.rows ?? 6,
    placeholder: options.placeholder ?? '',
    readonly: options.readonly ?? false,
    spellcheck: false,
  }) as HTMLTextAreaElement
  area.value = options.value ?? ''
  if (options.onInput) area.addEventListener('input', (event) => options.onInput!(area.value, event))
  return area
}

export interface SelectOption {
  value: string
  label: string
}

export interface SelectOptions extends FieldOptions {
  options: SelectOption[]
  value?: string
  onChange?: (value: string, event: Event) => void
}

export function select(options: SelectOptions): HTMLSelectElement {
  const node = el('select', { class: 'ts-k-select' }) as HTMLSelectElement
  for (const option of options.options) {
    node.append(el('option', { value: option.value, selected: option.value === options.value }, option.label))
  }
  if (options.value != null) node.value = options.value
  if (options.onChange) node.addEventListener('change', (event) => options.onChange!(node.value, event))
  return node
}

export interface CheckOptions {
  label: string
  hint?: string
  checked?: boolean
  onChange?: (checked: boolean, event: Event) => void
}

export function checkbox(options: CheckOptions): HTMLLabelElement {
  const box = el('input', { type: 'checkbox', checked: options.checked ?? false }) as HTMLInputElement
  if (options.onChange) box.addEventListener('change', (event) => options.onChange!(box.checked, event))
  const text = el('span', { class: 'ts-k-check__text' }, options.label)
  if (options.hint) text.append(el('small', {}, ` ${options.hint}`))
  return el('label', { class: 'ts-k-check' }, box, text)
}

export interface SliderOptions {
  label: string
  min: number
  max: number
  step?: number
  value: number
  /** Render the readout value; defaults to the raw number. */
  format?: (value: number) => string
  onInput?: (value: number, event: Event) => void
}

/** A slider with its label and live readout on one line — one row per knob. */
export function slider(options: SliderOptions): HTMLElement {
  const format = options.format ?? ((value: number) => String(value))
  const readout = el('span', { class: 'ts-k-slider__value ts-k-mono' }, format(options.value))
  const input = el('input', {
    class: 'ts-k-range',
    type: 'range',
    min: String(options.min),
    max: String(options.max),
    step: String(options.step ?? 1),
    value: String(options.value),
    'aria-label': options.label,
  }) as HTMLInputElement
  input.addEventListener('input', (event) => {
    const value = Number(input.value)
    readout.textContent = format(value)
    options.onInput?.(value, event)
  })
  return el(
    'div',
    { class: 'ts-k-slider' },
    el('div', { class: 'ts-k-slider__head' }, el('label', { class: 'ts-k-label' }, options.label), readout),
    input,
  )
}

/* -------------------------------------------------------------------------
   Buttons
   ------------------------------------------------------------------------- */

export interface ButtonOptions {
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  icon?: IconName | string
  size?: 'md' | 'sm'
  title?: string
  type?: 'button' | 'submit'
  disabled?: boolean
  /** Stretch to the full width of its container. */
  full?: boolean
  onClick?: (event: MouseEvent) => void
}

export function button(label: string, options: ButtonOptions = {}): HTMLButtonElement {
  const classes = ['ts-k-btn']
  if (options.variant && options.variant !== 'default') classes.push(`ts-k-btn--${options.variant}`)
  if (options.size === 'sm') classes.push('ts-k-btn--sm')
  if (options.full) classes.push('ts-k-btn--full')
  const node = el('button', {
    class: classes.join(' '),
    type: options.type ?? 'button',
    title: options.title ?? '',
    disabled: options.disabled ?? false,
  }) as HTMLButtonElement
  if (options.icon) node.append(iconEl(options.icon, options.size === 'sm' ? 14 : 16))
  if (label) node.append(el('span', {}, label))
  if (options.onClick) node.addEventListener('click', options.onClick as EventListener)
  return node
}

export interface IconButtonOptions {
  label: string
  variant?: 'default' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
  onClick?: (event: MouseEvent) => void
}

export function iconButton(iconName: IconName | string, options: IconButtonOptions): HTMLButtonElement {
  const classes = ['ts-k-iconbtn']
  if (options.variant && options.variant !== 'default') classes.push(`ts-k-iconbtn--${options.variant}`)
  if (options.size === 'sm') classes.push('ts-k-iconbtn--sm')
  const node = el(
    'button',
    {
      class: classes.join(' '),
      type: 'button',
      title: options.label,
      'aria-label': options.label,
    },
    iconEl(iconName, options.size === 'sm' ? 14 : 16),
  ) as HTMLButtonElement
  if (options.onClick) node.addEventListener('click', options.onClick as EventListener)
  return node
}

export interface SegmentedItem {
  value: string
  label: string
  /** Optional secondary line, e.g. a dimension or shortcut. */
  hint?: string
}

export interface SegmentedOptions {
  items: SegmentedItem[]
  value: string
  label?: string
  onChange?: (value: string) => void
}

export interface Segmented extends HTMLElement {
  /** Move the highlight without firing `onChange`, for external state changes. */
  setValue: (value: string) => void
}

/**
 * A segmented control: a set of mutually exclusive choices shown as buttons.
 * Replaces the "select + Apply" pattern that made many tools feel unfinished.
 */
export function segmented(options: SegmentedOptions): Segmented {
  const root = el('div', {
    class: 'ts-k-seg',
    role: 'radiogroup',
    ...(options.label ? { 'aria-label': options.label } : {}),
  })
  const buttons: HTMLButtonElement[] = []
  let current = options.value

  function paint() {
    buttons.forEach((node, index) => {
      const on = options.items[index].value === current
      node.classList.toggle('is-on', on)
      node.setAttribute('aria-checked', on ? 'true' : 'false')
    })
  }

  options.items.forEach((item) => {
    const node = el(
      'button',
      { class: 'ts-k-seg__item', type: 'button', role: 'radio' },
      el('span', { class: 'ts-k-seg__label' }, item.label),
      item.hint ? el('span', { class: 'ts-k-seg__hint' }, item.hint) : null,
    ) as HTMLButtonElement
    node.addEventListener('click', () => {
      current = item.value
      paint()
      options.onChange?.(item.value)
    })
    buttons.push(node)
    root.append(node)
  })
  paint()
  return Object.assign(root, {
    setValue: (value: string) => {
      current = value
      paint()
    },
  })
}

/* -------------------------------------------------------------------------
   File input
   ------------------------------------------------------------------------- */

export interface DropzoneOptions {
  /** "Choose an image…" or similar. */
  label?: string
  hint?: string
  accept?: string
  multiple?: boolean
  icon?: IconName | string
  /** Text files are read as text; anything else as an ArrayBuffer. */
  readAs?: 'text' | 'buffer'
  onFiles: (files: File[]) => void
  onText?: (text: string, files: File[]) => void
  onBuffers?: (buffers: ArrayBuffer[], files: File[]) => void
}

export interface Dropzone {
  root: HTMLElement
  input: HTMLInputElement
}

/**
 * A drop target plus a styled picker button. Drag-and-drop used to be
 * re-implemented per tool with slightly different visuals; this gives every
 * file tool the same affordance and the same "drop it here" feedback.
 */
export function dropzone(options: DropzoneOptions = { onFiles: () => {} }): Dropzone {
  const input = el('input', {
    class: 'ts-k-drop__input',
    type: 'file',
    accept: options.accept ?? '',
    multiple: options.multiple ?? false,
    'aria-label': options.label ?? 'Choose a file',
  }) as HTMLInputElement

  const root = el(
    'div',
    { class: 'ts-k-drop' },
    el('span', { class: 'ts-k-drop__icon' }, iconEl(options.icon ?? 'uploadCloud', 22)),
    el('span', { class: 'ts-k-drop__label' }, options.label ?? 'Drop a file here'),
    el('span', { class: 'ts-k-drop__hint' }, options.hint ?? 'or'),
    button('Choose a file', { size: 'sm', onClick: () => input.click() }),
    input,
  )

  async function deliver(files: File[]) {
    if (files.length === 0) return
    options.onFiles(files)
    if (options.onText) {
      options.onText((await Promise.all(files.map(readFileAsText))).join('\n'), files)
    }
    if (options.onBuffers) {
      options.onBuffers(await Promise.all(files.map(readFileAsArrayBuffer)), files)
    }
  }

  input.addEventListener('change', () => {
    void deliver(Array.from(input.files ?? []))
    input.value = ''
  })

  let depth = 0
  root.addEventListener('dragenter', (event) => {
    event.preventDefault()
    depth += 1
    root.classList.add('is-dragging')
  })
  root.addEventListener('dragover', (event) => event.preventDefault())
  root.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1)
    if (depth === 0) root.classList.remove('is-dragging')
  })
  root.addEventListener('drop', (event) => {
    event.preventDefault()
    depth = 0
    root.classList.remove('is-dragging')
    void deliver(Array.from(event.dataTransfer?.files ?? []))
  })

  return { root, input }
}

/* -------------------------------------------------------------------------
   Output
   ------------------------------------------------------------------------- */

export interface OutputOptions {
  label?: string
  /** Show a copy button; the value is read live so it can be a getter. */
  copy?: string | (() => string)
  meta?: string
  /** Tone the head label, e.g. to signal an error. */
  tone?: Tone
}

/**
 * A titled output block. The header carries the label, an optional meta and a
 * copy action; the body holds the value. One component covers the "encoded
 * result", "JSON", "digest" and "file info" cases that were previously four
 * hand-rolled variations.
 */
export interface OutputBlock extends HTMLElement {
  body: HTMLElement
  /** The live meta slot; create it up front so callers can always write to it. */
  meta: HTMLElement
  /** Replace the body contents without rebuilding the block. */
  setValue: (value: string | Node) => void
  /** Change the head label, e.g. to report a live status. */
  setLabel: (label: string) => void
  /** Change the head meta text. */
  setMeta: (text: string) => void
}

export function outputBlock(value: string | Node, options: OutputOptions = {}): OutputBlock {
  const body = el('div', { class: 'ts-k-out__body ts-k-mono' })
  body.append(typeof value === 'string' ? value : value)
  const label = el('span', { class: `ts-k-out__label${options.tone ? ` is-${options.tone}` : ''}` }, options.label ?? 'Output')
  const meta = el('span', { class: 'ts-k-out__meta' }, options.meta ?? '')
  if (!options.meta) meta.hidden = true
  const head = el('div', { class: 'ts-k-out__head' }, label, meta)
  if (options.copy != null) head.append(copyButton(options.copy, { label: 'Copy', size: 'sm' }))
  const root = el('div', { class: 'ts-k-out' }, head, body)
  const setMeta = (text: string) => {
    meta.textContent = text
    meta.hidden = text === ''
  }
  return Object.assign(root, {
    body,
    meta,
    setValue: (next: string | Node) => body.replaceChildren(typeof next === 'string' ? next : next),
    setLabel: (text: string) => {
      label.textContent = text
    },
    setMeta,
  })
}

export interface CopyButtonOptions {
  label?: string
  size?: 'md' | 'sm'
}

/** A button that copies a value and confirms on itself. */
export function copyButton(value: string | (() => string), options: CopyButtonOptions = {}): HTMLButtonElement {
  const read = typeof value === 'function' ? value : () => value
  const node = button(options.label ?? 'Copy', {
    icon: 'copy',
    size: options.size ?? 'md',
    variant: 'ghost',
  })
  node.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(read())
      const label = node.querySelector('span')
      if (label) {
        const original = label.textContent
        label.textContent = 'Copied'
        setTimeout(() => (label.textContent = original), 900)
      }
    } catch {
      /* clipboard blocked; the value stays selectable */
    }
  })
  return node
}

/** A label + value row with a copy button, for key/value result lists. */
export function copyRow(label: string, value: string | (() => string)): HTMLElement {
  return el(
    'div',
    { class: 'ts-k-kv' },
    el('span', { class: 'ts-k-kv__label' }, label),
    el('span', { class: 'ts-k-kv__value ts-k-mono' }, typeof value === 'function' ? value() : value),
    copyButton(value, { label: 'Copy', size: 'sm' }),
  )
}

export interface StatOptions {
  label: string
  value: string
  hint?: string
}

/** A single figure in a stat strip. */
export function stat(options: StatOptions): HTMLElement {
  const root = el(
    'div',
    { class: 'ts-k-stat' },
    el('span', { class: 'ts-k-stat__value ts-k-mono' }, options.value),
    el('span', { class: 'ts-k-stat__label' }, options.label),
  )
  if (options.hint) root.append(el('span', { class: 'ts-k-stat__hint' }, options.hint))
  return root
}

/** A horizontal strip of stats. */
export function stats(...children: (Node | string)[]): HTMLElement {
  return el('div', { class: 'ts-k-stats' }, ...children)
}

/** A small status pill. */
export function badge(text: string, tone: Tone = 'neutral'): HTMLElement {
  return el('span', { class: `ts-k-badge ts-k-badge--${tone}` }, text)
}

/** A quiet note; tone it to warn or flag an error. */
export function note(text: string, tone: Tone = 'neutral'): HTMLElement {
  return el('p', { class: `ts-k-note ts-k-note--${tone}` }, text)
}

/* -------------------------------------------------------------------------
   Media
   ------------------------------------------------------------------------- */

export interface MediaFrameOptions {
  /** Accessible description of the media. */
  alt?: string
  /** Cap the rendered height; images keep their aspect ratio. */
  maxHeight?: number
  /** Checkerboard behind the media, to reveal transparency. */
  checker?: boolean
}

export interface MediaFrame {
  root: HTMLElement
  image: HTMLImageElement
}

/**
 * A bounded frame for an image or preview.
 *
 * Image tools used to drop a raw `<img>` into the page, so a 6000px photo
 * rendered at its natural size and pushed everything else off screen. The
 * frame always clamps to its container and to a sane max height, and lets the
 * media shrink inside it.
 */
export function mediaFrame(options: MediaFrameOptions = {}): MediaFrame {
  const image = el('img', { class: 'ts-k-media__img', alt: options.alt ?? '' }) as HTMLImageElement
  const root = el(
    'div',
    {
      class: `ts-k-media${options.checker ? ' ts-k-media--checker' : ''}`,
      style: options.maxHeight ? `--ts-k-media-h:${options.maxHeight}px` : undefined,
    },
    image,
  )
  return { root, image }
}

export interface MediaToolbarOptions {
  /** Filename suggested when the download button is pressed. */
  filename: string
  /** Returns the blob/string to save; called on click. */
  getData: () => Blob | string | null
  mime?: string
  onReset?: () => void
}

/** The standard download / reset action row that sits under a media frame. */
export function mediaToolbar(options: MediaToolbarOptions): HTMLElement {
  const save = button('Download', {
    variant: 'primary',
    icon: 'download',
    onClick: () => {
      const data = options.getData()
      if (data != null) download(options.filename, data, options.mime)
    },
  })
  const row = actions(save)
  if (options.onReset) row.append(button('Start over', { icon: 'refresh', onClick: options.onReset }))
  return row
}

/* -------------------------------------------------------------------------
   Table
   ------------------------------------------------------------------------- */

export interface TableColumn {
  key: string
  label: string
  mono?: boolean
}

/** A scrollable, sticky-header data table. */
export function table(columns: TableColumn[], rows: Record<string, string | Node>[]): HTMLElement {
  const head = el('tr', {}, ...columns.map((column) => el('th', {}, column.label)))
  const body = el(
    'tbody',
    {},
    ...rows.map((row) =>
      el(
        'tr',
        {},
        ...columns.map((column) =>
          el('td', { class: column.mono ? 'ts-k-mono' : undefined }, row[column.key] ?? ''),
        ),
      ),
    ),
  )
  return el('div', { class: 'ts-k-tablewrap' }, el('table', { class: 'ts-k-table' }, el('thead', {}, head), body))
}

/** Re-export so tools can build one-off markup without another import. */
export { icon, iconEl, download }
