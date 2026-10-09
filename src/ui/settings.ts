import { clear, el } from '../core/dom'
import { favourites, onFavouritesChange } from '../core/favourites'
import { clearRecents, onRecentsChange, recents } from '../core/recents'
import { CHOICES, resetSettings, setSetting, settings } from '../core/settings'
import {
  PRESETS,
  activeTheme,
  applyThemeToDocument,
  basePalette,
  customFrom,
  isHex,
  presetById,
  resolvePalette,
  useCustom,
  usePreset,
} from '../core/theme'
import type { ActiveTheme, CustomTheme, Palette, ThemeSpec } from '../core/theme'

/**
 * The Settings page.
 *
 * A view over `core/settings` and `core/theme`, composed from the shared
 * markup and the `ts-set-*` classes in main.css — it does not introduce a
 * second component kit. Theme edits apply live as you pick a colour; the tool
 * preferences write straight through the settings store.
 */

const PALETTE_LABELS: Record<keyof Palette, string> = {
  bg: 'Background',
  bgSoft: 'Surface',
  bgInput: 'Input',
  bgElevated: 'Raised',
  border: 'Border',
  borderStrong: 'Strong border',
  fg: 'Text',
  muted: 'Muted text',
  faint: 'Faint text',
}

/** The palette fields behind "More colours"; the three headline ones stay out. */
const ADVANCED_KEYS: (keyof Palette)[] = [
  'bgInput',
  'bgElevated',
  'border',
  'borderStrong',
  'muted',
  'faint',
]

/** A small three-stop preview of a theme: page, raised surface and accent. */
function themePreview(theme: ActiveTheme): HTMLElement {
  return el('span', {
    class: 'ts-set-preview',
    style:
      `--p-bg:${theme.palette.bg};--p-surface:${theme.palette.bgElevated};` +
      `--p-border:${theme.palette.border};--p-fg:${theme.palette.fg};--p-accent:${theme.accent}`,
    'aria-hidden': 'true',
  })
}

/** Compose a previewable theme from a preset or a custom draft. */
function previewFor(spec: ThemeSpec | CustomTheme): ActiveTheme {
  if ('base' in spec) {
    const base = presetById(spec.base)
    return {
      presetId: null,
      custom: spec,
      dark: spec.dark,
      name: spec.name,
      palette: resolvePalette(basePalette(spec.dark), spec.palette),
      accent: spec.accent,
      ok: spec.ok ?? base?.ok ?? '#3ddc97',
      warn: spec.warn ?? base?.warn ?? '#e6b450',
      danger: spec.danger ?? base?.danger ?? '#ff6b6b',
    }
  }
  return {
    presetId: spec.id,
    custom: null,
    dark: spec.dark,
    name: spec.name,
    palette: { ...spec.palette },
    accent: spec.accent,
    ok: spec.ok ?? '#3ddc97',
    warn: spec.warn ?? '#e6b450',
    danger: spec.danger ?? '#ff6b6b',
  }
}

function sectionHead(title: string, blurb: string): HTMLElement {
  return el('div', { class: 'ts-set-head' }, el('h2', {}, title), el('p', {}, blurb))
}

function colorRow(
  label: string,
  value: string,
  onInput: (next: string) => void,
): HTMLElement {
  const swatch = el('input', {
    class: 'ts-k-color',
    type: 'color',
    value,
    'aria-label': label,
  }) as HTMLInputElement
  const hex = el('input', {
    class: 'ts-k-input ts-k-mono ts-set-hex',
    type: 'text',
    value,
    maxlength: '7',
    spellcheck: 'false',
    'aria-label': `${label} hex value`,
  }) as HTMLInputElement
  function commit(next: string) {
    if (!isHex(next)) return
    swatch.value = next
    hex.value = next
    onInput(next)
  }
  swatch.addEventListener('input', () => commit(swatch.value))
  hex.addEventListener('input', () => commit(hex.value))
  return el(
    'label',
    { class: 'ts-set-color' },
    el('span', { class: 'ts-set-color__label' }, label),
    el('span', { class: 'ts-set-color__controls' }, swatch, hex),
  )
}

export function settingsPage(): HTMLElement {
  const page = el('section', { class: 'ts-set' })
  const body = el('div', { class: 'ts-set-body' })
  page.append(body)

  function repaint() {
    clear(body)
    const active = activeTheme()
    const prefs = settings()

    body.append(
      el(
        'header',
        { class: 'ts-set-title' },
        el('p', { class: 'ts-eyebrow' }, 'Settings'),
        el('h1', {}, 'Make toolspace yours'),
        el(
          'p',
          { class: 'ts-lede' },
          'Every choice on this page is saved in this browser and nowhere else. Clear your site data and it is gone.',
        ),
      ),

      el(
        'section',
        { class: 'ts-set-section' },
        sectionHead('Appearance', 'Twelve presets, or build one from any colours you like.'),
        el(
          'div',
          { class: 'ts-set-presets', role: 'list' },
          ...PRESETS.map((preset) => presetButton(preset, active.custom === null && active.name === preset.name)),
        ),
        builder(active),
      ),

      el(
        'section',
        { class: 'ts-set-section' },
        sectionHead('Tools', 'How the catalogue behaves.'),
        row(
          'Network tools',
          'Tools that contact a third-party host. Off hides them completely, so nothing can leave the tab.',
          switchControl(prefs.networkTools, (on) => setSetting('networkTools', on)),
        ),
        row(
          'Row density',
          'How tightly tool rows pack into the index.',
          segmentedControl('density', prefs.density, CHOICES.density),
        ),
        row(
          'Show sigils',
          'The little per-tool mark beside names in lists and headings.',
          switchControl(prefs.showSigils, (on) => setSetting('showSigils', on)),
        ),
        row(
          'Content width',
          'The reading column on a tool page.',
          segmentedControl('contentWidth', prefs.contentWidth, CHOICES.contentWidth),
        ),
        row(
          'Show stats',
          'The count strip under the home-page masthead.',
          switchControl(prefs.showStats, (on) => setSetting('showStats', on)),
        ),
      ),

      el(
        'section',
        { class: 'ts-set-section' },
        sectionHead('Behaviour', 'Small conveniences.'),
        row(
          'Recently opened',
          'Keep a short list of the tools you open and show it on the home page.',
          switchControl(prefs.recents, (on) => setSetting('recents', on)),
        ),
        row(
          'Motion',
          'Animation follows the system by default, and is always reduced when you ask.',
          segmentedControl('motion', prefs.motion, CHOICES.motion),
        ),
      ),

      el(
        'section',
        { class: 'ts-set-section' },
        sectionHead('Your data', 'Stored on this device, never uploaded.'),
        el(
          'div',
          { class: 'ts-set-data' },
          el('span', { class: 'ts-set-count' }, `${favourites().length} starred · ${recents().length} recent`),
          el(
            'div',
            { class: 'ts-set-actions' },
            el(
              'button',
              {
                type: 'button',
                class: 'ts-k-btn',
                onclick: () => {
                  clearRecents()
                },
              },
              'Clear recents',
            ),
            el(
              'button',
              {
                type: 'button',
                class: 'ts-k-btn',
                onclick: () => {
                  resetSettings()
                  usePreset('voltage')
                  applyThemeToDocument(activeTheme())
                  repaint()
                },
              },
              'Reset all settings',
            ),
          ),
        ),
      ),

      el(
        'p',
        { class: 'ts-set-foot' },
        'No account, no sync, no telemetry. ',
        el('a', { href: '#/' }, 'Back to the tools'),
        '.',
      ),
    )
  }

  function presetButton(preset: ThemeSpec, isActive: boolean): HTMLElement {
    return el(
      'button',
      {
        type: 'button',
        class: `ts-set-preset${isActive ? ' is-active' : ''}`,
        role: 'listitem',
        'aria-pressed': String(isActive),
        title: `${preset.name} — ${preset.dark ? 'dark' : 'light'}`,
        onclick: () => {
          usePreset(preset.id)
          applyThemeToDocument(activeTheme())
          repaint()
        },
      },
      themePreview(previewFor(preset)),
      el(
        'span',
        { class: 'ts-set-preset__meta' },
        el('span', { class: 'ts-set-preset__name' }, preset.name),
        el('span', { class: 'ts-set-preset__tone' }, preset.dark ? 'dark' : 'light'),
      ),
    )
  }

  /** The custom-theme editor: a base ramp, the key colours, then save. */
  function builder(active: ActiveTheme): HTMLElement {
    const draft: CustomTheme = { ...(active.custom ?? customFrom(active, 'voltage')) }

    const preview = el('span', { class: 'ts-set-builder__preview' })
    function live() {
      applyThemeToDocument(previewFor(draft))
      clear(preview)
      preview.append(themePreview(previewFor(draft)))
    }
    live()

    const name = el('input', {
      class: 'ts-k-input',
      type: 'text',
      value: draft.name,
      maxlength: '32',
      'aria-label': 'Theme name',
      placeholder: 'My theme',
    }) as HTMLInputElement
    name.addEventListener('input', () => {
      draft.name = name.value.slice(0, 32) || 'My theme'
    })

    const ramp = el(
      'div',
      { class: 'ts-set-seg', role: 'radiogroup', 'aria-label': 'Base ramp' },
      ...([true, false] as const).map((dark) =>
        el(
          'button',
          {
            type: 'button',
            class: `ts-set-seg__item${draft.dark === dark ? ' is-on' : ''}`,
            role: 'radio',
            'aria-checked': String(draft.dark === dark),
            onclick: () => {
              draft.dark = dark
              draft.base = dark ? 'voltage' : 'paper'
              // Switching ramp restarts from its surfaces, keeping the accent.
              draft.palette = {}
              live()
              repaint()
            },
          },
          dark ? 'Dark ramp' : 'Light ramp',
        ),
      ),
    )

    const palette = resolvePalette(basePalette(draft.dark), draft.palette)

    return el(
      'div',
      { class: 'ts-set-builder' },
      el('div', { class: 'ts-set-builder__head' }, el('h3', {}, 'Build your own'), preview),
      el(
        'div',
        { class: 'ts-set-builder__grid' },
        el('label', { class: 'ts-set-field' }, el('span', {}, 'Name'), name),
        el('div', { class: 'ts-set-field' }, el('span', {}, 'Base ramp'), ramp),
        colorRow('Background', palette.bg, (next) => {
          draft.palette = { ...draft.palette, bg: next }
          live()
        }),
        colorRow('Surface', palette.bgSoft, (next) => {
          draft.palette = { ...draft.palette, bgSoft: next }
          live()
        }),
        colorRow('Text', palette.fg, (next) => {
          draft.palette = { ...draft.palette, fg: next }
          live()
        }),
        colorRow('Accent', draft.accent, (next) => {
          draft.accent = next
          live()
        }),
        el(
          'details',
          { class: 'ts-set-advanced' },
          el('summary', {}, 'More colours'),
          el(
            'div',
            { class: 'ts-set-advanced__body' },
            ...ADVANCED_KEYS.map((key) =>
              colorRow(PALETTE_LABELS[key], palette[key], (next) => {
                draft.palette = { ...draft.palette, [key]: next }
                live()
              }),
            ),
          ),
        ),
      ),
      el(
        'div',
        { class: 'ts-set-builder__foot' },
        el(
          'span',
          { class: 'ts-set-derived' },
          'Button text and the focus colour are derived from your accent automatically.',
        ),
        el(
          'div',
          { class: 'ts-set-actions' },
          active.custom
            ? el(
                'button',
                {
                  type: 'button',
                  class: 'ts-k-btn',
                  onclick: () => {
                    usePreset('voltage')
                    applyThemeToDocument(activeTheme())
                    repaint()
                  },
                },
                'Discard',
              )
            : null,
          el(
            'button',
            {
              type: 'button',
              class: 'ts-k-btn ts-k-btn--primary',
              onclick: () => {
                useCustom(draft)
                applyThemeToDocument(activeTheme())
                repaint()
              },
            },
            active.custom ? 'Update theme' : 'Save theme',
          ),
        ),
      ),
    )
  }

  repaint()
  // Keep the starred/recent counts honest if they change while this page is up.
  onFavouritesChange(repaint)
  onRecentsChange(repaint)
  return page
}

/** A labelled settings row with its control on the right. */
function row(title: string, blurb: string, control: HTMLElement): HTMLElement {
  return el(
    'div',
    { class: 'ts-set-row' },
    el(
      'div',
      { class: 'ts-set-row__text' },
      el('span', { class: 'ts-set-row__title' }, title),
      el('p', {}, blurb),
    ),
    control,
  )
}

function switchControl(value: boolean, onChange: (next: boolean) => void): HTMLElement {
  const box = el('input', {
    type: 'checkbox',
    class: 'ts-set-switch',
    checked: value,
    'aria-label': 'Toggle',
  }) as HTMLInputElement
  box.addEventListener('change', () => onChange(box.checked))
  return el(
    'label',
    { class: 'ts-set-switchwrap' },
    box,
    el('span', { class: 'ts-set-switch__track', 'aria-hidden': 'true' }),
  )
}

function segmentedControl<K extends 'density' | 'motion' | 'contentWidth'>(
  name: K,
  value: string,
  choices: readonly { value: string; label: string }[],
): HTMLElement {
  return el(
    'div',
    { class: 'ts-set-seg', role: 'radiogroup', 'aria-label': name },
    ...choices.map((choice) =>
      el(
        'button',
        {
          type: 'button',
          class: `ts-set-seg__item${choice.value === value ? ' is-on' : ''}`,
          role: 'radio',
          'aria-checked': String(choice.value === value),
          onclick: () => setSetting(name, choice.value as never),
        },
        choice.label,
      ),
    ),
  )
}
