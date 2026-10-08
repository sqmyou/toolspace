import { describe, expect, it } from 'vitest'
import { doubleQuote, escape, isSafe, quote, quoteAll, quoteMinimal, ShellError, splitWords, summarise } from './shell'

describe('isSafe', () => {
  it('accepts ordinary words', () => {
    expect(isSafe('hello')).toBe(true)
    expect(isSafe('a-b_c.txt')).toBe(true)
    expect(isSafe('key=value')).toBe(true)
    expect(isSafe('/usr/local/bin')).toBe(true)
  })

  it('rejects anything needing quotes', () => {
    expect(isSafe('')).toBe(false)
    expect(isSafe('two words')).toBe(false)
    expect(isSafe('it$var')).toBe(false)
    expect(isSafe('a|b')).toBe(false)
    expect(isSafe("don't")).toBe(false)
  })
})

describe('quote', () => {
  it('leaves safe words alone', () => {
    expect(quote('hello')).toBe('hello')
    expect(quote('--flag=1')).toBe('--flag=1')
  })

  it('quotes an empty string', () => {
    expect(quote('')).toBe("''")
  })

  it('wraps unsafe words in single quotes', () => {
    expect(quote('two words')).toBe("'two words'")
    expect(quote('a$b')).toBe("'a$b'")
  })

  it('handles an embedded single quote', () => {
    expect(quote("don't")).toBe("'don'\\''t'")
  })

  it('produces something a shell would read back as one word', () => {
    for (const word of ["don't", 'a b', 'a"b', 'line\nbreak', '$HOME', 'back\\slash', '*', '']) {
      // Split the quoted form again; it must come back as the same single word.
      expect(splitWords(quote(word))).toEqual([word])
    }
  })
})

describe('quoteAll', () => {
  it('joins quoted words with spaces', () => {
    expect(quoteAll(['rm', '-rf', 'my dir'])).toBe("rm -rf 'my dir'")
  })

  it('round-trips through splitWords', () => {
    const words = ['git', 'commit', '-m', "fix: don't break", '--author=A B <a@b.c>']
    expect(splitWords(quoteAll(words))).toEqual(words)
  })
})

describe('doubleQuote', () => {
  it('escapes what stays special in double quotes', () => {
    expect(doubleQuote('a$b')).toBe('"a\\$b"')
    expect(doubleQuote('a"b')).toBe('"a\\"b"')
    expect(doubleQuote('a\\b')).toBe('"a\\\\b"')
  })

  it('round-trips through splitWords', () => {
    for (const word of ['a$b', 'a"b', 'back\\slash', 'plain']) {
      expect(splitWords(doubleQuote(word))).toEqual([word])
    }
  })
})

describe('splitWords', () => {
  it('splits on whitespace', () => {
    expect(splitWords('git status')).toEqual(['git', 'status'])
    expect(splitWords('  a   b\tc  ')).toEqual(['a', 'b', 'c'])
  })

  it('honours single quotes', () => {
    expect(splitWords("echo 'hello world'")).toEqual(['echo', 'hello world'])
    expect(splitWords("echo '$HOME'")).toEqual(['echo', '$HOME'])
  })

  it('honours double quotes and keeps expansions literal', () => {
    expect(splitWords('echo "hello world"')).toEqual(['echo', 'hello world'])
    expect(splitWords('echo "$HOME"')).toEqual(['echo', '$HOME'])
  })

  it('handles backslash escapes', () => {
    expect(splitWords('echo hello\\ world')).toEqual(['echo', 'hello world'])
    expect(splitWords('echo a\\$b')).toEqual(['echo', 'a$b'])
  })

  it('keeps empty quoted words', () => {
    expect(splitWords("echo '' x")).toEqual(['echo', '', 'x'])
    expect(splitWords('echo ""')).toEqual(['echo', ''])
  })

  it('joins adjacent quoted and bare parts', () => {
    expect(splitWords("a'b'c")).toEqual(['abc'])
    expect(splitWords('a"b"c')).toEqual(['abc'])
  })

  it('returns nothing for blank input', () => {
    expect(splitWords('')).toEqual([])
    expect(splitWords('   ')).toEqual([])
  })

  it('can reject an unterminated quote', () => {
    expect(() => splitWords("echo 'unclosed", { strict: true })).toThrow(ShellError)
    expect(splitWords("echo 'unclosed")).toEqual(['echo', "'unclosed"])
  })
})

describe('escape', () => {
  it('escapes only the special characters', () => {
    expect(escape('hello')).toBe('hello')
    expect(escape('a b')).toBe('a\\ b')
    expect(escape('a$b')).toBe('a\\$b')
  })

  it('round-trips through splitWords', () => {
    for (const word of ['a b', 'a$b', 'a|b', "it's"]) {
      expect(splitWords(escape(word))).toEqual([word])
    }
  })
})

describe('quoteMinimal', () => {
  it('quotes only what needs it', () => {
    expect(quoteMinimal(['ls', 'my dir', '-la'])).toBe("ls 'my dir' -la")
  })
})

describe('summarise', () => {
  it('reports the quoted form and the unsafe words', () => {
    const result = summarise(['cp', 'a b', 'c'])
    expect(result.quoted).toBe("cp 'a b' c")
    expect(result.unsafe).toEqual(['a b'])
    expect(result.longest).toBe(3)
  })
})
