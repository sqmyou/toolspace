import { describe, expect, it } from 'vitest'
import {
  beautify,
  beautifyCss,
  beautifyJs,
  detectLanguage,
  minify,
  minifyCss,
  minifyJs,
  needsSpaceBetween,
  tokenizeJs,
} from './code'

describe('tokenizeJs', () => {
  it('finds words, numbers, strings and punctuation', () => {
    const types = tokenizeJs('const a = 1 + 2.5; "hi"').map((token) => token.type)
    expect(types).toContain('word')
    expect(types).toContain('number')
    expect(types).toContain('string')
    expect(types).toContain('punct')
  })

  it('reads a regex, not division, after a keyword', () => {
    const tokens = tokenizeJs('const re = /a\\/b[/]c/g')
    expect(tokens.find((token) => token.type === 'regex')?.value).toBe('/a\\/b[/]c/g')
  })

  it('reads division after an identifier', () => {
    const tokens = tokenizeJs('const x = a / b')
    expect(tokens.some((token) => token.type === 'regex')).toBe(false)
  })

  it('keeps a template literal whole, newlines included', () => {
    const tokens = tokenizeJs('const t = `line\nline`')
    expect(tokens.find((token) => token.type === 'string')?.value).toBe('`line\nline`')
  })

  it('recognises both comment styles', () => {
    const tokens = tokenizeJs('a // one\nb /* two */ c')
    expect(tokens.filter((token) => token.type === 'comment')).toHaveLength(2)
  })

  it('flags a newline before a token', () => {
    const tokens = tokenizeJs('a\nb')
    expect(tokens[1].newlineBefore).toBe(true)
  })
})

describe('minifyJs', () => {
  it('strips comments and redundant whitespace', () => {
    const out = minifyJs('const  a = 1 ; // note\nconst b = 2;')
    expect(out).toBe('const a=1;\nconst b=2;')
  })

  it('never joins two words with a space removed', () => {
    expect(minifyJs('typeof   x')).toBe('typeof x')
    expect(minifyJs('a  in  b')).toBe('a in b')
  })

  it('keeps newlines so ASI is preserved', () => {
    const out = minifyJs('let a = 1\nlet b = 2')
    expect(out).toBe('let a=1\nlet b=2')
  })

  it('does not turn two operators into a comment', () => {
    expect(minifyJs('a + +b')).toBe('a+ +b')
    expect(minifyJs('a / /x/.source')).toBe('a/ /x/.source')
  })

  it('is stable when run twice', () => {
    const once = minifyJs('const x = { a: 1,  b: 2 }  // c')
    expect(minifyJs(once)).toBe(once)
  })

  it('never removes a string', () => {
    expect(minifyJs(`const s = "keep // me"`)).toContain('"keep // me"')
  })

  it('reports the bytes saved', () => {
    const result = minify('a   =   1 // comment', 'javascript')
    expect(result.saved).toBeGreaterThan(0)
    expect(result.before).toBeGreaterThan(result.after)
  })
})

describe('needsSpaceBetween', () => {
  const token = (type: 'word' | 'punct' | 'number', value: string) => ({ type, value, newlineBefore: false })
  it('separates adjacent words', () => {
    expect(needsSpaceBetween(token('word', 'return'), token('word', 'x'))).toBe(true)
  })
  it('treats joined punct as needing a space', () => {
    expect(needsSpaceBetween(token('punct', '+'), token('punct', '+'))).toBe(true)
  })
})

describe('beautifyJs', () => {
  it('breaks braces and statements onto their own lines', () => {
    const out = beautifyJs('function f(){return 1;}')
    expect(out).toContain('function f() {')
    expect(out).toContain('\n  return 1;')
    expect(out).toContain('\n}')
  })

  it('keeps the code valid enough to re-read', () => {
    const out = beautifyJs('if(a){b()}else{c()}')
    expect(out).toContain('if(a) {')
    expect(out).toContain('\n}')
  })

  it('round-trips through the tokenizer without merging tokens', () => {
    const out = beautifyJs('const a=typeof b')
    expect(out).toBe('const a = typeof b')
  })

  it('keeps comments', () => {
    expect(beautifyJs('// keep\nconst a = 1;')).toContain('// keep')
  })
})

describe('minifyCss', () => {
  it('removes comments and collapses whitespace', () => {
    expect(minifyCss('a {\n  color: red; /* c */\n}')).toBe('a{color:red}')
  })

  it('keeps descendant space and space around the child combinator', () => {
    expect(minifyCss('a > b { color : red ; }')).toBe('a>b{color:red}')
    expect(minifyCss('.x :hover { color: red }')).toBe('.x :hover{color:red}')
  })

  it('does not touch a selector pseudo-class', () => {
    expect(minifyCss('a:hover { x: 1 }')).toBe('a:hover{x:1}')
  })

  it('preserves a data URI inside url()', () => {
    const out = minifyCss('.a { background: url("data:image/svg+xml,<svg  />") }')
    expect(out).toContain('data:image/svg+xml,<svg  />')
  })

  it('preserves an attribute selector and its quotes', () => {
    expect(minifyCss('a[href="a > b"] { x: 1 }')).toBe('a[href="a > b"]{x:1}')
  })

  it('drops the final semicolon before a closing brace', () => {
    expect(minifyCss('a { color: red; }')).not.toContain(';}')
  })

  it('is stable when run twice', () => {
    const once = minifyCss('.a { color: red; }\n@media (max-width: 10px) { .b { x: 1 } }')
    expect(minifyCss(once)).toBe(once)
  })

  it('keeps calc() spacing that is load-bearing', () => {
    expect(minifyCss('.a { width: calc(100% - 2px) }')).toContain('calc(100% - 2px)')
  })
})

describe('beautifyCss', () => {
  it('indents one declaration per line', () => {
    expect(beautifyCss('a{color:red;background:blue}')).toBe('a {\n  color: red;\n  background: blue\n}')
  })

  it('spaces a declaration colon but not a selector one', () => {
    const out = beautifyCss('a:hover{color:red}')
    expect(out).toContain('a:hover {')
    expect(out).toContain('color: red')
  })

  it('nests at-rules', () => {
    const out = beautifyCss('@media screen{.a{x:1}}')
    expect(out).toContain('@media screen {')
    expect(out).toContain('  .a {')
  })
})

describe('detectLanguage', () => {
  it('picks css for a rule', () => {
    expect(detectLanguage('.a { color: red; }')).toBe('css')
  })
  it('picks javascript for code', () => {
    expect(detectLanguage('const f = () => console.log(1)')).toBe('javascript')
  })
})

describe('minify', () => {
  it('routes to the css path', () => {
    expect(minify('a { color: red }', 'css').output).toBe('a{color:red}')
  })
  it('routes to the js path', () => {
    expect(minify('const a = 1 // x', 'javascript').output).toBe('const a=1')
  })
})

describe('beautify', () => {
  it('is a no-op shape for empty input', () => {
    expect(beautify('', 'javascript')).toBe('')
    expect(beautify('', 'css')).toBe('')
  })
})

describe('the output still runs', () => {
  const source = `
    // add up, skipping the odd ones
    function total(list) {
      let sum = 0
      for (const n of list) {
        if (n % 2 === 0) sum += n
      }
      return sum
    }
    module.exports = total([1, 2, 3, 4, 5, 6])
  `

  const run = (code: string) => new Function('module', 'return (() => { ' + code + '; return module.exports })()')({})

  it('minified code computes the same value', () => {
    const minified = minifyJs(source)
    expect(run(minified)).toBe(12)
    expect(minified).not.toContain('// add up')
  })

  it('beautified code computes the same value', () => {
    expect(run(beautifyJs(source))).toBe(12)
  })

  it('minifying twice changes nothing more', () => {
    const once = minifyJs(source)
    expect(minifyJs(once)).toBe(once)
  })

  it('keeps a division/regex sandwich working', () => {
    const code = 'module.exports = 10 / 2 / /x/.source.length'
    expect(run(minifyJs(code))).toBe(run(code))
  })

  it('keeps a template literal with newlines intact', () => {
    const code = 'module.exports = `a\nb`.length'
    expect(run(minifyJs(code))).toBe(run(code))
  })

  it('does not split a compound assignment operator', () => {
    expect(minifyJs('a += 1')).toBe('a+=1')
    expect(minifyJs('a -= 1')).toBe('a-=1')
    expect(beautifyJs('a+=1')).toContain('a += 1')
  })

  it('keeps statements on separate lines when there are no semicolons', () => {
    const code = 'let a = 1\nlet b = 2\nmodule.exports = a + b'
    expect(run(beautifyJs(code))).toBe(3)
  })
})
