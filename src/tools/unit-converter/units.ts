/**
 * Unit conversion.
 *
 * Every unit in a category is expressed against one base unit as a linear
 * transform: `base = value * factor + offset`. The offset is zero everywhere
 * except temperature, which is the only common family that is not a pure
 * scaling, so one formula covers the whole catalogue.
 */

export interface Unit {
  id: string
  name: string
  symbol: string
  /** Multiplier to the category base unit. */
  factor: number
  /** Added after the multiply; only temperature uses this. */
  offset?: number
}

export interface UnitCategory {
  id: string
  name: string
  /** Unit a fresh category starts on. */
  defaultUnit: string
  units: Unit[]
}

export class UnitError extends Error {}

const u = (id: string, name: string, symbol: string, factor: number, offset = 0): Unit => ({
  id,
  name,
  symbol,
  factor,
  offset,
})

export const CATEGORIES: UnitCategory[] = [
  {
    id: 'length',
    name: 'Length',
    defaultUnit: 'm',
    units: [
      u('nm', 'Nanometre', 'nm', 1e-9),
      u('um', 'Micrometre', 'µm', 1e-6),
      u('mm', 'Millimetre', 'mm', 1e-3),
      u('cm', 'Centimetre', 'cm', 1e-2),
      u('m', 'Metre', 'm', 1),
      u('km', 'Kilometre', 'km', 1000),
      u('in', 'Inch', 'in', 0.0254),
      u('ft', 'Foot', 'ft', 0.3048),
      u('yd', 'Yard', 'yd', 0.9144),
      u('mi', 'Mile', 'mi', 1609.344),
      u('nmi', 'Nautical mile', 'nmi', 1852),
    ],
  },
  {
    id: 'mass',
    name: 'Mass',
    defaultUnit: 'kg',
    units: [
      u('mg', 'Milligram', 'mg', 1e-6),
      u('g', 'Gram', 'g', 1e-3),
      u('kg', 'Kilogram', 'kg', 1),
      u('t', 'Tonne', 't', 1000),
      u('oz', 'Ounce', 'oz', 0.028349523125),
      u('lb', 'Pound', 'lb', 0.45359237),
      u('st', 'Stone', 'st', 6.35029318),
      u('ton', 'US ton', 'ton', 907.18474),
    ],
  },
  {
    id: 'temperature',
    name: 'Temperature',
    defaultUnit: 'c',
    units: [
      u('c', 'Celsius', '°C', 1),
      u('f', 'Fahrenheit', '°F', 5 / 9, -160 / 9),
      u('k', 'Kelvin', 'K', 1, -273.15),
      u('r', 'Rankine', '°R', 5 / 9, -273.15),
    ],
  },
  {
    id: 'area',
    name: 'Area',
    defaultUnit: 'm2',
    units: [
      u('mm2', 'Square millimetre', 'mm²', 1e-6),
      u('cm2', 'Square centimetre', 'cm²', 1e-4),
      u('m2', 'Square metre', 'm²', 1),
      u('km2', 'Square kilometre', 'km²', 1e6),
      u('ha', 'Hectare', 'ha', 10000),
      u('acre', 'Acre', 'ac', 4046.8564224),
      u('in2', 'Square inch', 'in²', 0.00064516),
      u('ft2', 'Square foot', 'ft²', 0.09290304),
      u('yd2', 'Square yard', 'yd²', 0.83612736),
      u('mi2', 'Square mile', 'mi²', 2589988.110336),
    ],
  },
  {
    id: 'volume',
    name: 'Volume',
    defaultUnit: 'l',
    units: [
      u('ml', 'Millilitre', 'mL', 1e-3),
      u('l', 'Litre', 'L', 1),
      u('m3', 'Cubic metre', 'm³', 1000),
      u('cm3', 'Cubic centimetre', 'cm³', 1e-3),
      u('tsp', 'Teaspoon (US)', 'tsp', 0.00492892159375),
      u('tbsp', 'Tablespoon (US)', 'tbsp', 0.01478676478125),
      u('floz', 'Fluid ounce (US)', 'fl oz', 0.0295735295625),
      u('cup', 'Cup (US)', 'cup', 0.2365882365),
      u('pt', 'Pint (US)', 'pt', 0.473176473),
      u('qt', 'Quart (US)', 'qt', 0.946352946),
      u('gal', 'Gallon (US)', 'gal', 3.785411784),
      u('galuk', 'Gallon (UK)', 'gal UK', 4.54609),
    ],
  },
  {
    id: 'speed',
    name: 'Speed',
    defaultUnit: 'mps',
    units: [
      u('mps', 'Metres per second', 'm/s', 1),
      u('kmh', 'Kilometres per hour', 'km/h', 1 / 3.6),
      u('mph', 'Miles per hour', 'mph', 0.44704),
      u('fps', 'Feet per second', 'ft/s', 0.3048),
      u('knot', 'Knot', 'kn', 0.5144444444444445),
      u('mach', 'Mach (at 15 °C)', 'Mach', 340.29),
    ],
  },
  {
    id: 'time',
    name: 'Time',
    defaultUnit: 's',
    units: [
      u('ns', 'Nanosecond', 'ns', 1e-9),
      u('us', 'Microsecond', 'µs', 1e-6),
      u('ms', 'Millisecond', 'ms', 1e-3),
      u('s', 'Second', 's', 1),
      u('min', 'Minute', 'min', 60),
      u('h', 'Hour', 'h', 3600),
      u('day', 'Day', 'd', 86400),
      u('week', 'Week', 'wk', 604800),
      u('month', 'Month (30.44 days)', 'mo', 2629746),
      u('year', 'Year (365.25 days)', 'yr', 31557600),
    ],
  },
  {
    id: 'data-rate',
    name: 'Data rate',
    defaultUnit: 'mbps',
    units: [
      u('bps', 'Bits per second', 'bit/s', 1),
      u('kbps', 'Kilobits per second', 'kbit/s', 1000),
      u('mbps', 'Megabits per second', 'Mbit/s', 1e6),
      u('gbps', 'Gigabits per second', 'Gbit/s', 1e9),
      u('kibps', 'Kibibits per second', 'Kibit/s', 1024),
      u('mibps', 'Mebibits per second', 'Mibit/s', 1048576),
      u('gibps', 'Gibibits per second', 'Gibit/s', 1073741824),
      u('bps-b', 'Bytes per second', 'B/s', 8),
      u('kbps-b', 'Kilobytes per second', 'kB/s', 8000),
      u('mbps-b', 'Megabytes per second', 'MB/s', 8e6),
      u('gbps-b', 'Gigabytes per second', 'GB/s', 8e9),
    ],
  },
  {
    id: 'angle',
    name: 'Angle',
    defaultUnit: 'deg',
    units: [
      u('deg', 'Degree', '°', 1),
      u('rad', 'Radian', 'rad', 57.29577951308232),
      u('grad', 'Gradian', 'grad', 0.9),
      u('turn', 'Turn', 'turn', 360),
      u('arcmin', 'Arcminute', '′', 1 / 60),
      u('arcsec', 'Arcsecond', '″', 1 / 3600),
    ],
  },
  {
    id: 'pressure',
    name: 'Pressure',
    defaultUnit: 'kpa',
    units: [
      u('pa', 'Pascal', 'Pa', 1e-3),
      u('kpa', 'Kilopascal', 'kPa', 1),
      u('mpa', 'Megapascal', 'MPa', 1000),
      u('bar', 'Bar', 'bar', 100),
      u('mbar', 'Millibar', 'mbar', 0.1),
      u('atm', 'Atmosphere', 'atm', 101.325),
      u('psi', 'Pounds per square inch', 'psi', 6.894757293168361),
      u('torr', 'Torr', 'Torr', 0.13332236842105263),
      u('mmhg', 'Millimetre of mercury', 'mmHg', 0.133322387415),
    ],
  },
  {
    id: 'energy',
    name: 'Energy',
    defaultUnit: 'j',
    units: [
      u('j', 'Joule', 'J', 1),
      u('kj', 'Kilojoule', 'kJ', 1000),
      u('cal', 'Calorie', 'cal', 4.184),
      u('kcal', 'Kilocalorie', 'kcal', 4184),
      u('wh', 'Watt-hour', 'Wh', 3600),
      u('kwh', 'Kilowatt-hour', 'kWh', 3.6e6),
      u('ev', 'Electronvolt', 'eV', 1.602176634e-19),
      u('btu', 'British thermal unit', 'BTU', 1055.05585262),
      u('ftlb', 'Foot-pound', 'ft·lb', 1.3558179483314004),
    ],
  },
  {
    id: 'power',
    name: 'Power',
    defaultUnit: 'w',
    units: [
      u('w', 'Watt', 'W', 1),
      u('kw', 'Kilowatt', 'kW', 1000),
      u('mw', 'Megawatt', 'MW', 1e6),
      u('hp', 'Horsepower (mechanical)', 'hp', 745.6998715822702),
      u('ps', 'Horsepower (metric)', 'PS', 735.49875),
      u('btuh', 'BTU per hour', 'BTU/h', 0.2930710701722222),
    ],
  },
]

export function findCategory(id: string): UnitCategory | undefined {
  return CATEGORIES.find((category) => category.id === id)
}

export function findUnit(category: UnitCategory, id: string): Unit | undefined {
  return category.units.find((unit) => unit.id === id)
}

/** Convert a value from one unit to another inside a single category. */
export function convertUnit(value: number, from: Unit, to: Unit): number {
  if (!Number.isFinite(value)) throw new UnitError('Enter a number to convert.')
  const base = value * from.factor + (from.offset ?? 0)
  return (base - (to.offset ?? 0)) / to.factor
}

/** Convert one value into every unit of its category. */
export function convertToAll(value: number, from: Unit, category: UnitCategory): { unit: Unit; value: number }[] {
  return category.units.map((unit) => ({ unit, value: convertUnit(value, from, unit) }))
}

/**
 * Read a number out of user input, tolerating the separators people paste
 * (thousands commas, underscores, a leading plus). Throws with a plain reason
 * when the input is not a number.
 */
export function parseUnitInput(text: string): number {
  const cleaned = text.trim().replace(/[, _']/g, '')
  if (!cleaned) throw new UnitError('Enter a value to convert.')
  const value = Number(cleaned)
  if (!Number.isFinite(value)) throw new UnitError('That is not a number.')
  return value
}

/** A compact, readable rendering: fixed for everyday sizes, e-notation at the edges. */
export function formatUnitValue(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e12 || abs < 1e-6) {
    return value.toExponential(6).replace(/\.?0+e/, 'e').replace('e+', 'e')
  }
  const decimals = Math.min(10, Math.max(0, 8 - Math.floor(Math.log10(abs)) - 1))
  return value
    .toFixed(decimals)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
}
