/**
 * Geometry for the image resizer.
 *
 * The generic maths (fit-within, percentage scaling) already lives with the
 * image converter and is imported from there; what is specific to this tool is
 * the preset catalogue and the fit/fill/stretch decision.
 */
import { fitWithin, scaleByPercent, type Dimensions } from '../image-converter/image'

export type { Dimensions }

export interface Preset {
  id: string
  label: string
  width: number
  height: number
  group: 'Social' | 'Web' | 'Video'
}

/**
 * The sizes people actually need. Ordered by group, largest first, so the
 * common ones sit near the top of the list.
 */
export const PRESETS: Preset[] = [
  { id: 'ig-square', label: 'Instagram post', width: 1080, height: 1080, group: 'Social' },
  { id: 'ig-portrait', label: 'Instagram portrait', width: 1080, height: 1350, group: 'Social' },
  { id: 'ig-story', label: 'Instagram story / Reel', width: 1080, height: 1920, group: 'Social' },
  { id: 'x-post', label: 'X / Twitter post', width: 1600, height: 900, group: 'Social' },
  { id: 'li-banner', label: 'LinkedIn banner', width: 1584, height: 396, group: 'Social' },
  { id: 'fb-cover', label: 'Facebook cover', width: 1640, height: 856, group: 'Social' },
  { id: 'og-image', label: 'Open Graph / link preview', width: 1200, height: 630, group: 'Web' },
  { id: 'avatar', label: 'Avatar', width: 512, height: 512, group: 'Web' },
  { id: 'favicon', label: 'Favicon', width: 180, height: 180, group: 'Web' },
  { id: 'uhd', label: '4K UHD', width: 3840, height: 2160, group: 'Video' },
  { id: 'fhd', label: 'Full HD', width: 1920, height: 1080, group: 'Video' },
  { id: 'hd', label: 'HD 720p', width: 1280, height: 720, group: 'Video' },
]

export type ResizeMode = 'fit' | 'fill' | 'stretch'

export const MODE_HINTS: Record<ResizeMode, string> = {
  fit: 'Scale to fit inside the box, keeping the aspect ratio. Never upscales.',
  fill: 'Fill the box, keeping the aspect ratio, cropping the overflow from the centre.',
  stretch: 'Force the exact box size, ignoring the aspect ratio.',
}

/**
 * The canvas size the image will be drawn at.
 *
 * `fit` refuses to enlarge, so a small source stays small rather than turning
 * to mush; `fill` and `stretch` are explicit requests for the preset size and
 * so are allowed to scale up.
 */
export function targetBox(source: Dimensions, box: Dimensions, mode: ResizeMode): Dimensions {
  if (mode === 'stretch') {
    return { width: Math.max(1, Math.round(box.width)), height: Math.max(1, Math.round(box.height)) }
  }
  if (mode === 'fill') {
    const scale = Math.max(box.width / source.width, box.height / source.height)
    return {
      width: Math.max(1, Math.round(source.width * scale)),
      height: Math.max(1, Math.round(source.height * scale)),
    }
  }
  return fitWithin(source, box)
}

/** Scale a source by a percentage, for the "by percent" control. */
export function percentBox(source: Dimensions, percent: number): Dimensions {
  return scaleByPercent(source, percent)
}

/**
 * Where to start reading the source so that a `fill` crop is centred. The
 * result is negative or zero, and is passed straight to `drawImage`.
 */
export function cropOffset(source: Dimensions, box: Dimensions): { x: number; y: number } {
  return { x: (source.width - box.width) / 2, y: (source.height - box.height) / 2 }
}

/** e.g. "photo-1080x1080.png" — self-describing in a downloads folder. */
export function resizeFilename(original: string, box: Dimensions, extension: string): string {
  const base = original.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_') || 'image'
  return `${base}-${box.width}x${box.height}.${extension}`
}

export function presetsInGroup(group: Preset['group']): Preset[] {
  return PRESETS.filter((preset) => preset.group === group)
}

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id)
}
