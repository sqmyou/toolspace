/**
 * Passphrase generation from a bundled word list.
 *
 * Randomness comes from `crypto.getRandomValues` with rejection sampling, so
 * every word is equally likely — slicing a random number modulo the list size
 * would bias the first few entries.
 */

export interface PassphraseOptions {
  words?: number
  separator?: string
  capitalise?: boolean
  addNumber?: boolean
}

export interface Passphrase {
  text: string
  words: string[]
  entropyBits: number
  strength: 'weak' | 'fair' | 'strong' | 'excellent'
}

/** A compact list of short, common, easy-to-type English words. */
export const WORD_LIST: string[] = [
  'acid', 'acorn', 'actor', 'album', 'alert', 'alien', 'amber', 'angle', 'ankle', 'apple',
  'april', 'arena', 'argue', 'armor', 'arrow', 'aside', 'atlas', 'attic', 'audio', 'aunt',
  'autumn', 'awake', 'axis', 'azure', 'bacon', 'badge', 'baker', 'bamboo', 'banana', 'banjo',
  'barn', 'basic', 'basil', 'basket', 'battle', 'beach', 'beacon', 'beam', 'bean', 'bear',
  'beaver', 'bench', 'berry', 'bicycle', 'birch', 'bishop', 'bison', 'blade', 'blank', 'blaze',
  'blend', 'blimp', 'bloom', 'bluff', 'board', 'bonus', 'bottle', 'bounce', 'bounty', 'bower',
  'brave', 'bread', 'breeze', 'brick', 'bridge', 'bright', 'bronze', 'brook', 'brush', 'bubble',
  'bucket', 'budget', 'buffalo', 'bugle', 'bundle', 'bunny', 'burst', 'butter', 'cabin', 'cable',
  'cactus', 'camel', 'candle', 'canoe', 'canyon', 'carbon', 'cargo', 'carpet', 'carrot', 'castle',
  'cattle', 'cavern', 'cedar', 'cello', 'cement', 'census', 'chalk', 'charm', 'chess', 'cherry',
  'cheese', 'chief', 'chime', 'chorus', 'cider', 'cinema', 'circle', 'citrus', 'clever', 'cliff',
  'climb', 'cloak', 'clock', 'cloud', 'clover', 'clown', 'coast', 'cobalt', 'cobra', 'cocoa',
  'coffee', 'comet', 'compass', 'copper', 'coral', 'cosmic', 'cotton', 'cougar', 'coyote', 'crane',
  'crater', 'crayon', 'cream', 'cricket', 'crimson', 'crisp', 'crystal', 'cymbal', 'daisy', 'dance',
  'dandy', 'dawn', 'deck', 'delta', 'denim', 'desert', 'diamond', 'diesel', 'digital', 'dinner',
  'dolphin', 'donkey', 'dragon', 'drum', 'dune', 'dusk', 'eagle', 'earth', 'easel', 'echo',
  'eclipse', 'elbow', 'elder', 'ember', 'emerald', 'engine', 'escape', 'ethics', 'expert', 'fabric',
  'falcon', 'fancy', 'feather', 'fennel', 'ferry', 'fiddle', 'field', 'fiesta', 'fir', 'flare',
  'flint', 'flute', 'forest', 'fossil', 'fountain', 'fox', 'frost', 'galaxy', 'garden', 'gecko',
  'ginger', 'glacier', 'glide', 'globe', 'glory', 'goat', 'granite', 'grape', 'gravity', 'green',
  'grove', 'guitar', 'gully', 'gypsum', 'hammer', 'harbor', 'hazel', 'helmet', 'heron', 'hickory',
  'honey', 'horizon', 'hunter', 'husky', 'igloo', 'indigo', 'iris', 'island', 'ivory', 'jacket',
  'jade', 'jaguar', 'jasmine', 'jelly', 'jersey', 'jewel', 'jolly', 'jungle', 'jupiter', 'kayak',
  'kettle', 'keystone', 'kitten', 'koala', 'lantern', 'lark', 'lava', 'lemon', 'leopard', 'lever',
  'lilac', 'linen', 'lion', 'lizard', 'llama', 'lobster', 'locket', 'lodge', 'lotus', 'lumber',
  'lunar', 'lynx', 'magnet', 'mango', 'maple', 'marble', 'marina', 'marsh', 'meadow', 'melon',
  'mesa', 'meteor', 'mint', 'mirror', 'mocha', 'monsoon', 'moose', 'mosaic', 'moss', 'mountain',
  'mural', 'music', 'nectar', 'needle', 'nickel', 'night', 'noble', 'nomad', 'noodle', 'north',
  'nova', 'nutmeg', 'oasis', 'ocean', 'olive', 'onyx', 'opal', 'orange', 'orbit', 'orchid',
  'otter', 'outpost', 'oyster', 'paddle', 'pagoda', 'palace', 'panda', 'panther', 'paper', 'parrot',
  'pastel', 'peach', 'pearl', 'pebble', 'pelican', 'penguin', 'pepper', 'petal', 'piano', 'pigeon',
  'pilot', 'pine', 'pistol', 'planet', 'plasma', 'plum', 'pocket', 'pollen', 'pony', 'poppy',
  'portal', 'potato', 'prairie', 'prism', 'puffin', 'pumpkin', 'quartz', 'quilt', 'quiver', 'rabbit',
  'radar', 'radish', 'rainbow', 'rally', 'raven', 'reef', 'relic', 'rhubarb', 'ribbon', 'ridge',
  'river', 'robin', 'rocket', 'rodeo', 'rooster', 'rose', 'ruby', 'rudder', 'rustic', 'saddle',
  'saffron', 'sage', 'salmon', 'sandal', 'sapphire', 'saturn', 'savanna', 'scarlet', 'school', 'scooter',
  'seagull', 'sequoia', 'shadow', 'shark', 'shelter', 'shore', 'signal', 'silver', 'sketch', 'sky',
  'slate', 'sleet', 'smoke', 'snapper', 'snow', 'socket', 'solar', 'sonnet', 'sorbet', 'sparrow',
  'spruce', 'squash', 'stadium', 'stampede', 'star', 'statue', 'steel', 'stereo', 'stone', 'storm',
  'stream', 'summit', 'sunset', 'surf', 'swallow', 'swan', 'sycamore', 'syrup', 'tablet', 'talon',
  'tangelo', 'tango', 'tapir', 'tavern', 'teal', 'tempo', 'tent', 'thistle', 'thunder', 'tiger',
  'timber', 'toast', 'tobacco', 'tomato', 'topaz', 'torch', 'tornado', 'tortoise', 'totem', 'tower',
  'trail', 'trapeze', 'treaty', 'treble', 'tropic', 'trout', 'tulip', 'tundra', 'tunnel', 'turban',
  'turtle', 'twilight', 'ultra', 'umbra', 'unicorn', 'upland', 'uranium', 'valley', 'vanilla', 'velvet',
  'venus', 'veranda', 'vertex', 'vessel', 'vineyard', 'violet', 'viper', 'vision', 'vista', 'volcano',
  'voyage', 'walnut', 'walrus', 'wander', 'wasabi', 'water', 'weasel', 'whale', 'wheat', 'whisker',
  'willow', 'window', 'winter', 'wizard', 'wombat', 'wonder', 'wren', 'yarrow', 'yodel', 'zebra',
  'zenith', 'zephyr', 'zigzag', 'zinc', 'zinnia', 'zodiac',
]

export class PassphraseError extends Error {}

const CAPITALISE_WORD = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

/** Uniform integer in [0, max) via rejection sampling. */
function randomInt(max: number): number {
  if (max <= 0) throw new PassphraseError('The range must be positive.')
  const limit = Math.floor(0x100000000 / max) * max
  const buffer = new Uint32Array(1)
  let value: number
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)
  return value % max
}

function strengthFor(bits: number): Passphrase['strength'] {
  if (bits < 50) return 'weak'
  if (bits < 75) return 'fair'
  if (bits < 100) return 'strong'
  return 'excellent'
}

export function generatePassphrase(options: PassphraseOptions = {}): Passphrase {
  const count = options.words ?? 4
  const separator = options.separator ?? '-'
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new PassphraseError('Choose between 1 and 20 words.')

  const words: string[] = []
  for (let i = 0; i < count; i++) {
    const word = WORD_LIST[randomInt(WORD_LIST.length)]
    words.push(options.capitalise ? CAPITALISE_WORD(word) : word)
  }

  let text = words.join(separator)
  let extraBits = 0
  if (options.addNumber) {
    const number = randomInt(100)
    text += separator + String(number).padStart(2, '0')
    extraBits = Math.log2(100)
  }

  const entropyBits = count * Math.log2(WORD_LIST.length) + extraBits
  return { text, words, entropyBits, strength: strengthFor(entropyBits) }
}

export function generateBatch(size = 5, options: PassphraseOptions = {}): Passphrase[] {
  if (size < 1 || size > 50) throw new PassphraseError('Batch size must be between 1 and 50.')
  return Array.from({ length: size }, () => generatePassphrase(options))
}

/** Entropy of a passphrase if the word list size and count are known. */
export function entropyBits(words: number, listSize = WORD_LIST.length, extraBits = 0): number {
  return words * Math.log2(listSize) + extraBits
}
