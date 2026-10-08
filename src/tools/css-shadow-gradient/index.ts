import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { boxShadowCss, gradientCss, randomHex, ruleFor, type GradientStop, type GradientType, type ShadowLayer } from './css'

const tool: Tool = {
  slug: 'css-shadow-gradient',
  name: 'CSS Shadow & Gradient Generator',
  description: 'Design box shadows and linear or radial gradients and copy the CSS.',
  category: 'Design',
  keywords: ['css', 'box-shadow', 'gradient', 'linear-gradient', 'radial-gradient', 'design', 'style'],
  render(root) {
    const layer: ShadowLayer = { x: 0, y: 8, blur: 24, spread: -4, color: 'rgba(0, 0, 0, 0.35)', inset: false }
    let type: GradientType = 'linear'
    let angle = 135
    const stops: GradientStop[] = [
      { color: '#7c3aed', position: 0 },
      { color: '#06b6d4', position: 100 },
    ]

    const preview = el('div', { class: 'ts-stage' })
    const box = el('div', { class: 'ts-stage-box' })
    const output = el('pre', { class: 'ts-code' })
    preview.append(box)

    const stopList = el('div', { class: 'ts-stop-list' })

    function update() {
      const shadow = boxShadowCss([layer])
      const gradient = gradientCss({ type, angle, stops })
      box.style.boxShadow = shadow
      box.style.background = gradient
      output.textContent = ruleFor('.element', { background: gradient, 'box-shadow': shadow })
    }

    function slider(label: string, value: number, min: number, max: number, step: number, onChange: (value: number) => void) {
      const input = el('input', { class: 'ts-range', type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) }) as HTMLInputElement
      const readout = el('span', { class: 'ts-mono ts-muted' }, String(value))
      input.addEventListener('input', () => {
        readout.textContent = input.value
        onChange(Number(input.value))
        update()
      })
      return el('div', { class: 'ts-slider-field' }, el('label', {}, label), input, readout)
    }

    function colorField(label: string, value: string, onChange: (value: string) => void) {
      const color = el('input', { type: 'color', class: 'ts-color', value }) as HTMLInputElement
      const text = el('input', { class: 'ts-input ts-mono', value }) as HTMLInputElement
      color.addEventListener('input', () => {
        text.value = color.value
        onChange(color.value)
        update()
      })
      text.addEventListener('input', () => {
        color.value = /^#[0-9a-f]{6}$/i.test(text.value) ? text.value : color.value
        onChange(text.value)
        update()
      })
      return el('div', { class: 'ts-field' }, el('label', {}, label), el('div', { class: 'ts-row' }, color, text))
    }

    function renderStops() {
      stopList.replaceChildren(
        ...stops.map((stop, index) =>
          el(
            'div',
            { class: 'ts-stop-row' },
            colorField(`Stop ${index + 1}`, stop.color, (value) => {
              stop.color = value
            }),
            slider('Position', stop.position, 0, 100, 1, (value) => {
              stop.position = value
            }),
            stops.length > 2
              ? el('button', {
                  class: 'ts-button',
                  type: 'button',
                  onclick: () => {
                    stops.splice(index, 1)
                    renderStops()
                    update()
                  },
                }, 'Remove')
              : null,
          ),
        ),
        el('button', {
          class: 'ts-button',
          type: 'button',
          onclick: () => {
            if (stops.length >= 5) return
            stops.push({ color: randomHex(), position: 50 })
            renderStops()
            update()
          },
        }, 'Add stop'),
      )
    }

    const typeSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    typeSelect.append(el('option', { value: 'linear' }, 'Linear'), el('option', { value: 'radial' }, 'Radial'))
    typeSelect.addEventListener('change', () => {
      type = typeSelect.value as GradientType
      update()
    })

    const insetBox = el('input', { type: 'checkbox' }) as HTMLInputElement
    insetBox.addEventListener('change', () => {
      layer.inset = insetBox.checked
      update()
    })

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        preview,
        el('div', { class: 'ts-two-col' },
          el('div', {},
            el('h3', { class: 'ts-subhead' }, 'Gradient'),
            el('div', { class: 'ts-row ts-wrap' }, el('div', { class: 'ts-inline-field' }, el('label', {}, 'Type'), typeSelect)),
            slider('Angle', angle, 0, 360, 1, (value) => {
              angle = value
            }),
            stopList,
          ),
          el('div', {},
            el('h3', { class: 'ts-subhead' }, 'Shadow'),
            slider('Horizontal offset', layer.x, -50, 50, 1, (value) => {
              layer.x = value
            }),
            slider('Vertical offset', layer.y, -50, 50, 1, (value) => {
              layer.y = value
            }),
            slider('Blur', layer.blur, 0, 100, 1, (value) => {
              layer.blur = value
            }),
            slider('Spread', layer.spread, -50, 50, 1, (value) => {
              layer.spread = value
            }),
            colorField('Shadow colour', layer.color, (value) => {
              layer.color = value
            }),
            el('label', { class: 'ts-inline-field' }, insetBox, 'Inset'),
          ),
        ),
        el('h3', { class: 'ts-subhead' }, 'CSS'),
        output,
        el('div', { class: 'ts-row ts-wrap' }, copyChip(() => output.textContent ?? '', 'Copy CSS')),
        el('p', { class: 'ts-note' }, 'Everything is generated locally; nothing is uploaded.'),
      ),
    )

    renderStops()
    update()
  },
}

export default tool
