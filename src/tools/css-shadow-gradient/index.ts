import {
  button,
  checkbox,
  colorField,
  outputBlock,
  panel,
  segmented,
  slider,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
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

    const stage = el('div', { class: 'ts-stage' }, el('div', { class: 'ts-stage-box' }))
    const box = stage.firstElementChild as HTMLElement
    const output = outputBlock('', { label: 'CSS', copy: () => output.body.textContent ?? '' })
    const stopList = el('div', { class: 'ts-stop-list' })

    function update() {
      const shadow = boxShadowCss([layer])
      const gradient = gradientCss({ type, angle, stops })
      box.style.boxShadow = shadow
      box.style.background = gradient
      output.body.replaceChildren(ruleFor('.element', { background: gradient, 'box-shadow': shadow }))
      output.setMeta('')
    }

    function renderStops() {
      stopList.replaceChildren(
        ...stops.map((stop, index) =>
          el(
            'div',
            { class: 'ts-stop-row' },
            colorField({
              value: stop.color,
              label: `Stop ${index + 1}`,
              onInput: (value) => {
                stop.color = value
                update()
              },
            }).root,
            slider({
              label: 'Position',
              value: stop.position,
              min: 0,
              max: 100,
              onInput: (value) => {
                stop.position = value
                update()
              },
            }),
            stops.length > 2
              ? button('Remove', {
                  size: 'sm',
                  onClick: () => {
                    stops.splice(index, 1)
                    renderStops()
                    update()
                  },
                })
              : null,
          ),
        ),
        button('Add stop', {
          size: 'sm',
          icon: 'plus',
          onClick: () => {
            if (stops.length >= 5) return
            stops.push({ color: randomHex(), position: 50 })
            renderStops()
            update()
          },
        }),
      )
    }

    root.append(
      toolLayout(
        { wide: true },
        stage,
        panel(
          { title: 'Gradient', icon: 'palette' },
          segmented({
            label: 'Type',
            value: 'linear',
            items: [
              { label: 'Linear', value: 'linear' },
              { label: 'Radial', value: 'radial' },
            ],
            onChange: (value) => {
              type = value as GradientType
              update()
            },
          }),
          slider({ label: 'Angle', value: angle, min: 0, max: 360, onInput: (value) => {
            angle = value
            update()
          } }),
          stopList,
        ),
        panel(
          { title: 'Shadow', icon: 'layers' },
          slider({ label: 'Horizontal offset', value: layer.x, min: -50, max: 50, onInput: (value) => {
            layer.x = value
            update()
          } }),
          slider({ label: 'Vertical offset', value: layer.y, min: -50, max: 50, onInput: (value) => {
            layer.y = value
            update()
          } }),
          slider({ label: 'Blur', value: layer.blur, min: 0, max: 100, onInput: (value) => {
            layer.blur = value
            update()
          } }),
          slider({ label: 'Spread', value: layer.spread, min: -50, max: 50, onInput: (value) => {
            layer.spread = value
            update()
          } }),
          colorField({
            value: layer.color,
            label: 'Shadow colour',
            text: true,
            onInput: (value) => {
              layer.color = value
              update()
            },
          }).root,
          checkbox({ label: 'Inset', onChange: (checked) => {
            layer.inset = checked
            update()
          } }),
        ),
        output,
              ),
    )

    renderStops()
    update()
  },
}

export default tool
