/**
 * A small EXIF reader.
 *
 * Locates the TIFF header inside JPEG, PNG, WebP or bare TIFF data, then walks
 * the IFD chain and formats the tags worth showing. It is deliberately
 * read-only: no thumbnails are decoded, and no image data is written.
 */

export interface ExifEntry {
  group: string
  tag: number
  name: string
  value: string
}

export interface ExifResult {
  format: 'jpeg' | 'png' | 'webp' | 'tiff'
  byteOrder: 'little' | 'big'
  entries: ExifEntry[]
}

export class ExifError extends Error {}

const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }

const TAG_NAMES: Record<number, string> = {
  0x0100: 'ImageWidth',
  0x0101: 'ImageLength',
  0x0102: 'BitsPerSample',
  0x0103: 'Compression',
  0x0106: 'PhotometricInterpretation',
  0x010e: 'ImageDescription',
  0x010f: 'Make',
  0x0110: 'Model',
  0x0111: 'StripOffsets',
  0x0112: 'Orientation',
  0x0115: 'SamplesPerPixel',
  0x0116: 'RowsPerStrip',
  0x0117: 'StripByteCounts',
  0x011a: 'XResolution',
  0x011b: 'YResolution',
  0x011c: 'PlanarConfiguration',
  0x0128: 'ResolutionUnit',
  0x0131: 'Software',
  0x0132: 'DateTime',
  0x013b: 'Artist',
  0x013e: 'WhitePoint',
  0x013f: 'PrimaryChromaticities',
  0x0201: 'JPEGInterchangeFormat',
  0x0202: 'JPEGInterchangeFormatLength',
  0x0211: 'YCbCrCoefficients',
  0x0213: 'YCbCrPositioning',
  0x0214: 'ReferenceBlackWhite',
  0x8298: 'Copyright',
  0x829a: 'ExposureTime',
  0x829d: 'FNumber',
  0x8769: 'ExifIFDPointer',
  0x8822: 'ExposureProgram',
  0x8824: 'SpectralSensitivity',
  0x8827: 'ISOSpeedRatings',
  0x8828: 'OECF',
  0x8830: 'SensitivityType',
  0x9000: 'ExifVersion',
  0x9003: 'DateTimeOriginal',
  0x9004: 'DateTimeDigitized',
  0x9101: 'ComponentsConfiguration',
  0x9102: 'CompressedBitsPerPixel',
  0x9201: 'ShutterSpeedValue',
  0x9202: 'ApertureValue',
  0x9203: 'BrightnessValue',
  0x9204: 'ExposureBiasValue',
  0x9205: 'MaxApertureValue',
  0x9206: 'SubjectDistance',
  0x9207: 'MeteringMode',
  0x9208: 'LightSource',
  0x9209: 'Flash',
  0x920a: 'FocalLength',
  0x927c: 'MakerNote',
  0x9286: 'UserComment',
  0x9290: 'SubSecTime',
  0x9291: 'SubSecTimeOriginal',
  0x9292: 'SubSecTimeDigitized',
  0xa000: 'FlashpixVersion',
  0xa001: 'ColorSpace',
  0xa002: 'PixelXDimension',
  0xa003: 'PixelYDimension',
  0xa004: 'RelatedSoundFile',
  0xa005: 'InteroperabilityIFDPointer',
  0xa20e: 'FocalPlaneXResolution',
  0xa20f: 'FocalPlaneYResolution',
  0xa210: 'FocalPlaneResolutionUnit',
  0xa217: 'SensingMethod',
  0xa300: 'FileSource',
  0xa301: 'SceneType',
  0xa401: 'CustomRendered',
  0xa402: 'ExposureMode',
  0xa403: 'WhiteBalance',
  0xa404: 'DigitalZoomRatio',
  0xa405: 'FocalLengthIn35mmFilm',
  0xa406: 'SceneCaptureType',
  0xa407: 'GainControl',
  0xa408: 'Contrast',
  0xa409: 'Saturation',
  0xa40a: 'Sharpness',
  0xa40c: 'SubjectDistanceRange',
  0xa420: 'ImageUniqueID',
  0xa430: 'CameraOwnerName',
  0xa431: 'BodySerialNumber',
  0xa432: 'LensSpecification',
  0xa433: 'LensMake',
  0xa434: 'LensModel',
  0xa435: 'LensSerialNumber',
  0x8825: 'GPSInfoIFDPointer',
}

const GPS_NAMES: Record<number, string> = {
  0x0000: 'GPSVersionID',
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude',
  0x0005: 'GPSAltitudeRef',
  0x0006: 'GPSAltitude',
  0x0007: 'GPSTimeStamp',
  0x0008: 'GPSSatellites',
  0x0009: 'GPSStatus',
  0x000a: 'GPSMeasureMode',
  0x000b: 'GPSDOP',
  0x000c: 'GPSSpeedRef',
  0x000d: 'GPSSpeed',
  0x000e: 'GPSTrackRef',
  0x000f: 'GPSTrack',
  0x0010: 'GPSImgDirectionRef',
  0x0011: 'GPSImgDirection',
  0x0012: 'GPSMapDatum',
  0x0013: 'GPSDestLatitudeRef',
  0x0014: 'GPSDestLatitude',
  0x0015: 'GPSDestLongitudeRef',
  0x0016: 'GPSDestLongitude',
  0x001d: 'GPSDateStamp',
  0x001e: 'GPSDifferential',
}

const FLASH: Record<number, string> = {
  0x0000: 'Flash did not fire',
  0x0001: 'Flash fired',
  0x0005: 'Fired, return light not detected',
  0x0007: 'Fired, return light detected',
  0x0009: 'Fired, compulsory flash mode',
  0x000d: 'Fired, compulsory, return light not detected',
  0x000f: 'Fired, compulsory, return light detected',
  0x0010: 'Did not fire, compulsory flash mode',
  0x0018: 'Did not fire, auto mode',
  0x0019: 'Fired, auto mode',
}

function findTiffStart(bytes: Uint8Array): { start: number; format: ExifResult['format'] } {
  // JPEG: scan markers for APP1 with an "Exif\0\0" signature.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2
    while (i + 4 <= bytes.length) {
      if (bytes[i] !== 0xff) {
        i++
        continue
      }
      const marker = bytes[i + 1]
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2
        continue
      }
      if (marker === 0xda || marker === 0xd9) break
      const size = (bytes[i + 2] << 8) | bytes[i + 3]
      if (size < 2) break
      if (marker === 0xe1) {
        const segment = bytes.subarray(i + 4, i + 4 + size - 2)
        if (segment[0] === 0x45 && segment[1] === 0x78 && segment[2] === 0x69 && segment[3] === 0x66) {
          return { start: i + 4 + 6, format: 'jpeg' }
        }
      }
      i += 2 + size
    }
    throw new ExifError('No EXIF data found in this JPEG.')
  }

  // PNG: the first eXIf chunk.
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (PNG_SIG.every((byte, index) => bytes[index] === byte)) {
    let i = 8
    while (i + 8 <= bytes.length) {
      const length = (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]
      const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7])
      if (type === 'eXIf') return { start: i + 8, format: 'png' }
      if (type === 'IEND') break
      i += 12 + length
    }
    throw new ExifError('No eXIf chunk found in this PNG.')
  }

  // WebP: a RIFF container with an EXIF chunk.
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'RIFF' && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WEBP') {
    let i = 12
    while (i + 8 <= bytes.length) {
      const fourcc = String.fromCharCode(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3])
      const size = bytes[i + 4] | (bytes[i + 5] << 8) | (bytes[i + 6] << 16) | (bytes[i + 7] << 24)
      if (fourcc === 'EXIF') {
        let start = i + 8
        if (bytes[start] === 0x45 && bytes[start + 1] === 0x78 && bytes[start + 2] === 0x69 && bytes[start + 3] === 0x66) start += 6
        return { start, format: 'webp' }
      }
      i += 8 + size + (size % 2)
    }
    throw new ExifError('No EXIF chunk found in this WebP.')
  }

  // Bare TIFF.
  const little = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 42 && bytes[3] === 0
  const big = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0 && bytes[3] === 42
  if (little || big) return { start: 0, format: 'tiff' }

  throw new ExifError('Unrecognised file. Drop a JPEG, PNG, WebP or TIFF image.')
}

interface Reader {
  bytes: Uint8Array
  little: boolean
  base: number
}

function u16(reader: Reader, offset: number): number {
  const index = reader.base + offset
  return reader.little ? reader.bytes[index] | (reader.bytes[index + 1] << 8) : (reader.bytes[index] << 8) | reader.bytes[index + 1]
}

function u32(reader: Reader, offset: number): number {
  const index = reader.base + offset
  return reader.little
    ? (reader.bytes[index] | (reader.bytes[index + 1] << 8) | (reader.bytes[index + 2] << 16) | (reader.bytes[index + 3] << 24)) >>> 0
    : ((reader.bytes[index] << 24) | (reader.bytes[index + 1] << 16) | (reader.bytes[index + 2] << 8) | reader.bytes[index + 3]) >>> 0
}

function readValue(reader: Reader, type: number, count: number, valueOffset: number): string {
  const size = (TYPE_SIZES[type] ?? 1) * count
  const inline = size <= 4
  const offset = inline ? valueOffset : u32(reader, valueOffset)
  const at = (index: number) => reader.base + offset + index
  if (reader.base + offset + size > reader.bytes.length) throw new ExifError('A tag value points past the end of the file.')

  const values: number[] = []
  for (let i = 0; i < count; i++) {
    switch (type) {
      case 1:
      case 6:
        values.push(reader.bytes[at(i)])
        break
      case 3:
      case 8:
        values.push(u16(reader, offset + i * 2))
        break
      case 4:
      case 9:
        values.push(u32(reader, offset + i * 4))
        break
      case 5:
      case 10: {
        const numerator = u32(reader, offset + i * 8)
        const denominator = u32(reader, offset + i * 8 + 4)
        values.push(denominator === 0 ? Number.NaN : numerator / denominator)
        break
      }
      default:
        break
    }
  }

  if (type === 2 || type === 7) {
    let text = ''
    for (let i = 0; i < count; i++) {
      const byte = reader.bytes[at(i)]
      if (byte === 0) break
      text += String.fromCharCode(byte)
    }
    return text.trim()
  }
  if (type === 5 || type === 10) {
    return values
      .map((value) => (Number.isNaN(value) ? '?' : value.toFixed(value % 1 === 0 ? 0 : 4).replace(/0+$/, '').replace(/\.$/, '')))
      .join(', ')
  }
  return values.join(', ')
}

function parseIfd(reader: Reader, offset: number, group: string, entries: ExifEntry[], visited: Set<number>, depth: number): void {
  if (depth > 4 || visited.has(offset)) return
  visited.add(offset)
  const count = u16(reader, offset)
  let cursor = offset + 2
  for (let i = 0; i < count; i++) {
    if (cursor + 12 > reader.bytes.length - reader.base) break
    const tag = u16(reader, cursor)
    const type = u16(reader, cursor + 2)
    const valueCount = u32(reader, cursor + 4)
    const valueOffset = cursor + 8
    const name =
      group === 'GPS' ? GPS_NAMES[tag] ?? `Tag 0x${tag.toString(16)}` : TAG_NAMES[tag] ?? `Tag 0x${tag.toString(16)}`

    if (tag === 0x8769) {
      parseIfd(reader, u32(reader, valueOffset), 'EXIF', entries, visited, depth + 1)
    } else if (tag === 0x8825) {
      parseIfd(reader, u32(reader, valueOffset), 'GPS', entries, visited, depth + 1)
    } else if (tag === 0xa005) {
      parseIfd(reader, u32(reader, valueOffset), 'Interop', entries, visited, depth + 1)
    } else if (type !== 0) {
      let value = readValue(reader, type, Math.min(valueCount, 64), valueOffset)
      if (tag === 0x9209 && group === 'EXIF') value = FLASH[Number(value)] ?? value
      if (tag === 0x9291) value = value
      entries.push({ group, tag, name, value })
    }
    cursor += 12
  }
  const next = u32(reader, offset + 2 + count * 12)
  if (next && depth === 0 && next < reader.bytes.length - reader.base) {
    parseIfd(reader, next, group, entries, visited, depth)
  }
}

export function parseExif(bytes: Uint8Array): ExifResult {
  if (bytes.length < 8) throw new ExifError('The file is too small to contain EXIF data.')
  const { start, format } = findTiffStart(bytes)
  const little = bytes[start] === 0x49
  const reader: Reader = { bytes, little, base: start }
  const ifd0 = u32(reader, 4)
  const entries: ExifEntry[] = []
  parseIfd(reader, ifd0, 'IFD0', entries, new Set(), 0)
  if (entries.length === 0) throw new ExifError('EXIF data was found but no readable tags were present.')
  return { format, byteOrder: little ? 'little' : 'big', entries }
}

export function groupEntries(entries: ExifEntry[]): { group: string; entries: ExifEntry[] }[] {
  const order: string[] = []
  const map = new Map<string, ExifEntry[]>()
  for (const entry of entries) {
    if (!map.has(entry.group)) {
      map.set(entry.group, [])
      order.push(entry.group)
    }
    map.get(entry.group)!.push(entry)
  }
  return order.map((group) => ({ group, entries: map.get(group)! }))
}

/** GPS coordinates are stored as three rationals; turn them into decimal degrees. */
export function gpsToDecimal(ref: string, values: number[]): number {
  if (values.length < 3) return Number.NaN
  const [degrees, minutes, seconds] = values
  const decimal = degrees + minutes / 60 + seconds / 3600
  return /[SW]/i.test(ref) ? -decimal : decimal
}
