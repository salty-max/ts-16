import { createMemory, type Memory } from './memory'
import { INSTRUCTIONS } from './instructions'
import { REGISTER_NAMES, type RegName } from './util/register'
import {
  ANSI_BLACK,
  ANSI_BOLD,
  ANSI_DIM,
  ANSI_GREEN,
  ANSI_RED,
  ANSI_RESET,
  fmt16,
} from './util/logger'

class CPU {
  private memory: Memory
  private prevRegisters: Record<RegName, number>
  private registers: Memory
  private registerMap: Record<RegName, number>

  constructor(memory: Memory) {
    this.memory = memory

    this.registers = createMemory(REGISTER_NAMES.length * 2)
    this.registerMap = REGISTER_NAMES.reduce(
      (map: Record<RegName, number>, name, i) => {
        map[name] = i * 2
        return map
      },
      {} as Record<RegName, number>
    )
    this.prevRegisters = Object.fromEntries(
      REGISTER_NAMES.map((n) => [n, this.getRegister(n)])
    ) as Record<RegName, number>
  }

  getRegister(name: RegName): number {
    if (!(name in this.registerMap)) {
      throw new Error(`getRegister: No such register: '${name}'`)
    }
    return this.registers.getUint16(this.getOffset(name))
  }

  setRegister(name: RegName, value: number) {
    return this.registers.setUint16(this.getOffset(name), value)
  }

  fetch() {
    const nextInstructionAddr = this.getRegister('ip')
    const instruction = this.memory.getUint8(nextInstructionAddr)
    this.setRegister('ip', nextInstructionAddr + 1)
    return instruction
  }

  fetch16() {
    const nextInstructionAddr = this.getRegister('ip')
    const instruction = this.memory.getUint16(nextInstructionAddr)
    this.setRegister('ip', nextInstructionAddr + 2)
    return instruction
  }

  execute(instruction: number) {
    switch (instruction) {
      case INSTRUCTIONS.MOV_LIT_R1: {
        const literal = this.fetch16()
        this.setRegister('r1', literal)
        return
      }
      case INSTRUCTIONS.MOV_LIT_R2: {
        const literal = this.fetch16()
        this.setRegister('r2', literal)
        return
      }
      case INSTRUCTIONS.ADD_REG_REG: {
        const r1 = this.fetch()
        const r2 = this.fetch()
        const r1Value = this.registers.getUint16(r1 * 2)
        const r2Value = this.registers.getUint16(r2 * 2)
        this.setRegister('acc', r1Value + r2Value)
        return
      }
    }
  }

  step() {
    const instruction = this.fetch()
    return this.execute(instruction)
  }

  debug(opts: { diffOnly?: boolean; arrows?: boolean } = {}) {
    let out = ''

    REGISTER_NAMES.forEach((name, i) => {
      const cur = this.getRegister(name)
      const prev = this.prevRegisters[name]
      const changed = prev !== undefined && prev !== cur

      if (opts.diffOnly && !changed) return

      const color = changed ? ANSI_GREEN : ANSI_BLACK
      const body =
        changed && opts.arrows && prev !== undefined
          ? `${fmt16(prev)}${ANSI_DIM} → ${ANSI_RESET}${color}${fmt16(cur)}`
          : fmt16(cur)

      out += `${name}:\t${color}${body}${ANSI_RESET}\t`

      if (!opts.diffOnly && (i + 1) % 4 === 0) out += '\n'
      this.prevRegisters[name] = cur
    })

    console.log(out + '\n')
  }

  debugDiff(
    opts: { unchanged?: 'hide' | 'dim' | 'show'; label?: string } = {}
  ) {
    const { unchanged = 'hide', label } = opts

    // Build current snapshot
    const curr = Object.fromEntries(
      REGISTER_NAMES.map((n) => [n, this.getRegister(n)])
    ) as Record<RegName, number>

    // If first run, seed prev and just print current as a "+" block
    const firstRun =
      !this.prevRegisters || Object.keys(this.prevRegisters).length === 0
    if (firstRun) {
      this.prevRegisters = { ...curr }
    }

    const nameWidth = Math.max(...REGISTER_NAMES.map((n) => n.length))

    let out = ''
    const headerLeft = label ? `prev (${label}-1)` : 'prev'
    const headerRight = label ? `curr (${label})` : 'curr'
    out += `${ANSI_BOLD}${ANSI_BLACK}--- ${headerLeft}${ANSI_RESET}\n`
    out += `${ANSI_BOLD}${ANSI_BLACK}+++ ${headerRight}${ANSI_RESET}\n`

    for (const name of REGISTER_NAMES) {
      const prev = this.prevRegisters[name]
      const cur = curr[name]
      const changed = prev !== cur

      if (!changed) {
        if (unchanged === 'hide') continue
        const line = ` ${name.padEnd(nameWidth)}: ${fmt16(cur)}`
        out +=
          (unchanged === 'dim'
            ? `${ANSI_DIM}${ANSI_BLACK}${line}${ANSI_RESET}`
            : line) + '\n'
        continue
      }

      // old (red) then new (green), like a unified diff
      out += `${ANSI_RED}-${name.padEnd(nameWidth)}: ${fmt16(prev)}${ANSI_RESET}\n`
      out += `${ANSI_GREEN}+${name.padEnd(nameWidth)}: ${fmt16(cur)}${ANSI_RESET}\n`
    }

    console.log(out.trimEnd() + '\n')

    // advance baseline
    this.prevRegisters = curr
  }

  private getOffset(name: RegName): number {
    const offset = this.registerMap[name]
    if (offset === undefined) {
      throw new Error(`No such register: '${name}'`)
    }
    return offset
  }
}

export default CPU
