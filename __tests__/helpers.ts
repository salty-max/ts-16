import { expect } from 'bun:test'
import CPU from '../src/cpu'
import { ANSI_BOLD, ANSI_GREY, ANSI_RESET } from '../src/util/logger'
import type { RegName } from '../src/util'
import { createMemory } from '../src/memory'

export const hi = (w: number) => (w >>> 8) & 0xff
export const lo = (w: number) => w & 0xff
export const word = (w: number) => [hi(w), lo(w)]

export function makeCPU(size = 0x10000) {
  return new CPU(createMemory(size))
}

export function loadProgram(cpu: CPU, bytes: number[]) {
  const u8 = new Uint8Array(cpu.getMemory().buffer)
  u8.fill(0)
  u8.set(bytes, 0)
}

/** Pretty stepper that prints a labeled diff and optional memory view */
export function stepAndShow(
  cpu: CPU,
  label: string,
  opts?: {
    unchanged?: 'hide' | 'dim' | 'show'
    memAt?: number
    memLen?: number
  }
) {
  cpu.step()
  cpu.debugDiff({ label, unchanged: opts?.unchanged ?? 'dim' })
  if (opts?.memAt !== undefined) {
    cpu.viewMemoryAt(opts.memAt, opts.memLen ?? 8)
  }
}

/** Optional: a tiny assertion helper that also emits a labeled diff on failure */
export function expectReg(cpu: CPU, reg: RegName, toBe: number, ctx?: string) {
  try {
    const got = cpu.getRegister(reg)
    expect(got).toBe(toBe)
  } catch (e) {
    console.log(
      `${ANSI_BOLD}${ANSI_GREY}Assertion failed${ANSI_RESET}${ctx ? `: ${ctx}` : ''}`
    )
    cpu.debugDiff({
      label: ctx ?? `after expecting ${reg}==${toBe}`,
      unchanged: 'show',
    })
    throw e
  }
}

/** Just a nice section header in output */
export function section(title: string) {
  console.log(`${ANSI_BOLD}${ANSI_GREY}── ${title} ──${ANSI_RESET}`)
}
