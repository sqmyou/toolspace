import {
  actions,
  button,
  field,
  imageBlock,
  note,
  panel,
  segmented,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import { download } from '../../core/ui'
import type { Tool } from '../../core/types'
import {
  BarcodeError,
  encode,
  EAN13_GUARDS,
  modulesToCanvas,
  modulesToSvg,
  normaliseInput,
  type Symbology,
} from './barcode'

const tool: Tool = {
  slug: 'barcode-generator',
  name: 'Barcode Generator',
  description: 'Create Code 128 and EAN-13 barcodes offline and download them as SVG or PNG.',
  category: 'Data',
  icon: 'chart',
  keywords: ['barcode', 'code 128', 'code128', 'ean', 'ean-13', 'upc', 'svg', 'png', 'label', 'gs1'],
  render(root) {
    let symbology: Symbology = 'code128'
    let modules = ''

    const input = textField({ value: 'TOOLSPACE-1234', mono: true, onInput: () => run() })
    input.setAttribute('autocomplete', 'off')
    input.setAttribute('spellcheck', 'false')

    const error = note('', 'danger')
    error.hidden = true
    const hint = el('p', { class: 'ts-k-hint' })

    const preview = imageBlock({ title: 'Preview', icon: 'chart', maxHeight: 220 })

    const svgButton = button('Download SVG', {
      icon: 'download',
      onClick: () => {
        if (!modules) return
        download('barcode.svg', toSvg(), 'image/svg+xml')
      },
    })
    const pngButton = button('Download PNG', {
      variant: 'primary',
      icon: 'download',
      onClick: () => {
        if (!modules) return
        toCanvas().toBlob((blob) => {
          if (blob) download('barcode.png', blob, 'image/png')
        }, 'image/png')
      },
    })

    const picker = segmented({
      label: 'Symbology',
      value: symbology,
      items: [
        { value: 'code128', label: 'Code 128', hint: 'Any printable ASCII' },
        { value: 'ean13', label: 'EAN-13', hint: '12 or 13 digits' },
      ],
      onChange: (value) => {
        symbology = value as Symbology
        input.value = symbology === 'ean13' ? '590123412345' : 'TOOLSPACE-1234'
        run()
      },
    })

    function guards() {
      return symbology === 'ean13' ? EAN13_GUARDS : []
    }

    function text() {
      return normaliseInput(symbology, input.value)
    }

    function toSvg(): string {
      return modulesToSvg(modules, { text: text(), height: 90 }, guards())
    }

    function toCanvas(): HTMLCanvasElement {
      return modulesToCanvas(modules, 900, { text: text(), height: 90 }, guards())
    }

    function run() {
      try {
        modules = encode(symbology, input.value)
        preview.frame.replaceChildren(el('div', { class: 'ts-barcode-frame', innerHTML: toSvg() }))
        preview.caption.textContent =
          symbology === 'ean13'
            ? `EAN-13 · ${text()} · ${modules.length} modules`
            : `Code 128 · ${modules.length} modules`
        error.hidden = true
        hint.textContent =
          symbology === 'ean13'
            ? 'Enter 12 digits and the check digit is added, or 13 with a correct check digit.'
            : 'Codes 1–128, letters, digits and punctuation. Runs of digits are packed automatically.'
        svgButton.disabled = false
        pngButton.disabled = false
      } catch (err) {
        modules = ''
        preview.frame.replaceChildren()
        preview.caption.textContent = ''
        error.textContent = err instanceof BarcodeError ? err.message : 'Could not build this barcode.'
        error.hidden = false
        svgButton.disabled = true
        pngButton.disabled = true
      }
    }

    root.append(
      toolLayout(
        {},
        panel(
          { title: 'Content', icon: 'code' },
          picker,
          field(input, { label: 'Value' }),
          error,
          hint,
        ),
        preview.root,
        actions(svgButton, pngButton),
              ),
    )

    run()
  },
}

export default tool
