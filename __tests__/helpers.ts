import { expect } from 'bun:test'
import CPU from '../src/cpu'
import { ANSI_BOLD, ANSI_GREY, ANSI_RESET, fmt16 } from '../src/util/logger'
import type { RegName } from '../src/util'
import { createMemory } from '../src/memory'
import { OPCODES } from '../src/instructions'

export const hi = (w: number) => (w >>> 8) & 0xff
export const lo = (w: number) => w & 0xff
export const word = (w: number) => [hi(w), lo(w)]

export function makeCPU(size = 256 * 256) {
  return new CPU(createMemory(size))
}

export function loadProgram(cpu: CPU, bytes: number[]) {
  const u8 = new Uint8Array(cpu.getMemory().buffer)
  u8.fill(0)
  u8.set(bytes, 0)
}

export function padTo(addr: number, currentLen: number): number[] {
  return Array.from(
    { length: Math.max(0, addr - currentLen) },
    () => OPCODES.NO_OP
  )
}

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

export function callFrameAddrs(cpu: CPU) {
  const fp = cpu.getRegister('fp')
  return {
    fp,
    frameSize: fp + 2,
    ra: fp + 4,
    regsBase: fp + 6,
  }
}

export function expectSavedRA(cpu: CPU, expectedRA: number, ctx?: string) {
  const { ra } = callFrameAddrs(cpu)
  expectMem(cpu, ra, expectedRA, ctx ?? `saved RA at ${fmt16(ra)}`)
}

export function expectAfterCallInvariant(cpu: CPU) {
  const sp = cpu.getRegister('sp')
  const fp = cpu.getRegister('fp')
  expect(sp).toBe(fp)
}

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

export function expectMem(cpu: CPU, addr: number, toBe: number, ctx?: string) {
  try {
    const got = cpu.getWord(addr)
    expect(got).toBe(toBe)
  } catch (e) {
    // Show a small memory window centered on addr (clamped at 0)
    const start = Math.max(0, addr - 8)
    console.log(
      `${ANSI_BOLD}${ANSI_GREY}Assertion failed${ANSI_RESET}${
        ctx ? `: ${ctx}` : ''
      }`
    )
    cpu.viewMemoryAt(start, 16)
    throw e
  }
}

export function expectIPDelta(
  cpu: CPU,
  beforeIP: number,
  delta: number,
  ctx?: string
) {
  try {
    const got = cpu.getRegister('ip')
    expect(got).toBe(beforeIP + delta)
  } catch (e) {
    console.log(
      `${ANSI_BOLD}${ANSI_GREY}Assertion failed${ANSI_RESET}${
        ctx ? `: ${ctx}` : ''
      }`
    )
    cpu.debugDiff({
      label: ctx ?? `after expecting ip==0x${(beforeIP + delta).toString(16)}`,
      unchanged: 'hide', // show only changed regs
    })
    throw e
  }
}

export function section(title: string) {
  console.log(`${ANSI_BOLD}${ANSI_GREY}── ${title} ──${ANSI_RESET}`)
}
