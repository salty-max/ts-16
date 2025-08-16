import type { Parser } from 'parsil'

export function runOk<T>(p: Parser<T>, input: string): T {
  const res = p.run(input)
  if (res.isError) {
    throw new Error(`Parse failed:\n${res.error}\nfor input: ${input}`)
  }
  return res.result
}

export function runFail<T>(p: Parser<T>, input: string): string {
  const res = p.run(input)
  if (!res.isError) {
    throw new Error(`Expected parse to fail, but it succeeded for: ${input}`)
  }
  return res.error
}
