import { createMemory, type Memory } from './memory'
import {
  INSTRUCTIONS,
  OPCODES,
  type Opcode,
  type OpcodeOperands,
} from './instructions'
import { regIndex, REGISTER_NAMES, type RegName } from './util/register'
import {
  ANSI_GREY,
  ANSI_BOLD,
  ANSI_DIM,
  ANSI_GREEN,
  ANSI_RED,
  ANSI_RESET,
  fmt16,
  ANSI_BLUE,
} from './util/logger'
import { u16 } from './util'
import { SHA224 } from 'bun'

class CPU {
  private memory: Memory
  private prevRegisters: Record<RegName, number>
  private registers: Memory

  constructor(memory: Memory) {
    this.memory = memory
    this.registers = createMemory(REGISTER_NAMES.length * 2)

    this.writeReg(regIndex('sp'), memory.byteLength - 1 - 1)
    this.writeReg(regIndex('fp'), memory.byteLength - 1 - 1)

    // Snapshot the initial registers values
    this.prevRegisters = Object.fromEntries(
      REGISTER_NAMES.map((n) => [n, this.readReg(regIndex(n))])
    ) as Record<RegName, number>
  }

  getMemory(): Memory {
    return this.memory
  }

  getRegister(name: RegName): number {
    return this.readReg(regIndex(name))
  }

  setRegister(name: RegName, value: number) {
    this.writeReg(regIndex(name), value)
  }

  getByte(addr: number): number {
    this.assertAddr(addr, 1)
    return this.memory.getUint8(addr)
  }

  setByte(addr: number, value: number) {
    this.assertAddr(addr, 1)
    this.memory.setUint8(addr, value & 0xff)
  }

  getWord(addr: number): number {
    this.assertAddr(addr, 2)
    return this.memory.getUint16(addr)
  }

  setWord(addr: number, value: number) {
    this.assertAddr(addr, 2)
    this.memory.setUint16(addr, u16(value))
  }

  execute<O extends Opcode>(opcode: O) {
    switch (opcode) {
      case OPCODES.MOV_LIT_REG: {
        const [lit, dst] = this.readOperands(OPCODES.MOV_LIT_REG)
        this.writeReg(dst, lit)
        return
      }
      case OPCODES.MOV_REG_REG: {
        const [src, dst] = this.readOperands(OPCODES.MOV_REG_REG)
        this.writeReg(dst, this.readReg(src))
        return
      }
      case OPCODES.MOV_REG_MEM: {
        const [src, addr] = this.readOperands(OPCODES.MOV_REG_MEM)
        this.setWord(addr, this.readReg(src))
        return
      }
      case OPCODES.MOV_MEM_REG: {
        const [addr, dst] = this.readOperands(OPCODES.MOV_MEM_REG)
        const value = this.getWord(addr)
        this.writeReg(dst, value)
        return
      }
      case OPCODES.MOV_LIT_MEM: {
        const [lit, addr] = this.readOperands(OPCODES.MOV_LIT_MEM)
        this.setWord(addr, lit)
        return
      }
      case OPCODES.PSH_LIT: {
        const [lit] = this.readOperands(OPCODES.PSH_LIT)
        this.push(lit)
        return
      }
      case OPCODES.PSH_REG: {
        const [src] = this.readOperands(OPCODES.PSH_REG)
        this.push(this.readReg(src))
        return
      }
      case OPCODES.POP: {
        const [dst] = this.readOperands(OPCODES.POP)
        const nextSP = this.readReg(regIndex('sp')) + 2
        this.writeReg(regIndex('sp'), nextSP)
        const value = this.getWord(nextSP)
        this.writeReg(dst, value)
        return
      }
      case OPCODES.ADD_REG_REG: {
        const [aReg, bReg] = this.readOperands(OPCODES.ADD_REG_REG)
        const sum = this.readReg(aReg) + this.readReg(bReg)
        this.writeReg(regIndex('acc'), sum)
        return
      }
      case OPCODES.JMP_NOT_EQ: {
        const [lit, addr] = this.readOperands(OPCODES.JMP_NOT_EQ)
        const value = this.readReg(regIndex('acc'))
        if (lit !== value) {
          this.writeReg(regIndex('ip'), addr)
        }
        return
      }
      case OPCODES.NO_OP: {
        return
      }
    }
  }

  step() {
    const opcode = this.fetch() as Opcode
    this.execute(opcode)
  }

  debug(opts: { diffOnly?: boolean; arrows?: boolean } = {}) {
    let out = ''
    REGISTER_NAMES.forEach((name, i) => {
      const cur = this.readReg(regIndex(name))
      const prev = this.prevRegisters[name]
      const changed = prev !== undefined && prev !== cur

      if (opts.diffOnly && !changed) return

      const color = changed ? ANSI_GREEN : ANSI_GREY
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
    const curr = Object.fromEntries(
      REGISTER_NAMES.map((n) => [n, this.readReg(regIndex(n))])
    ) as Record<RegName, number>

    const firstRun =
      !this.prevRegisters || Object.keys(this.prevRegisters).length === 0
    if (firstRun) {
      this.prevRegisters = { ...curr }
    }

    const nameWidth = Math.max(...REGISTER_NAMES.map((n) => n.length))
    let out = ''
    const headerLeft = label ? `prev (${label}-1)` : 'prev'
    const headerRight = label ? `curr (${label})` : 'curr'
    out += `${ANSI_BOLD}${ANSI_GREY}--- ${headerLeft}${ANSI_RESET}\n`
    out += `${ANSI_BOLD}${ANSI_GREY}+++ ${headerRight}${ANSI_RESET}\n`

    for (const name of REGISTER_NAMES) {
      const prev = this.prevRegisters[name]
      const cur = curr[name]
      const changed = prev !== cur

      if (!changed) {
        if (unchanged === 'hide') continue
        const line = ` ${name.padEnd(nameWidth)}: ${fmt16(cur)}`
        out +=
          (unchanged === 'dim'
            ? `${ANSI_DIM}${ANSI_GREY}${line}${ANSI_RESET}`
            : line) + '\n'
        continue
      }

      out += `${ANSI_RED}-${name.padEnd(nameWidth)}: ${fmt16(prev)}${ANSI_RESET}\n`
      out += `${ANSI_GREEN}+${name.padEnd(nameWidth)}: ${fmt16(cur)}${ANSI_RESET}\n`
    }
    console.log(out.trimEnd() + '\n')
    this.prevRegisters = curr
  }

  viewMemoryAt(addr: number, length = 8) {
    // clamp start
    if (addr < 0) addr = 0
    if (addr >= this.memory.byteLength) {
      console.log(`${ANSI_BLUE}${fmt16(addr)}${ANSI_RESET}: <out of range>`)
      return
    }

    // clamp length so we don’t overrun RAM
    const maxLen = Math.min(length, this.memory.byteLength - addr)
    const bytes = Array.from({ length: maxLen }, (_, i) =>
      this.getByte(addr + i)
    )

    const hexCol = bytes
      .map((v) =>
        v === 0
          ? `${ANSI_DIM}00${ANSI_RESET}`
          : `${ANSI_GREEN}${v.toString(16).padStart(2, '0')}${ANSI_RESET}`
      )
      .join(' ')

    const asciiCol = bytes
      .map((v) => (v >= 0x20 && v <= 0x7e ? String.fromCharCode(v) : '.'))
      .join('')

    console.log(
      `${ANSI_BLUE}${fmt16(addr)}${ANSI_RESET}: ${hexCol}  ${ANSI_DIM}|${asciiCol}|${ANSI_RESET}`
    )
  }
  private assertReg(idx: number) {
    if (idx < 0 || idx >= REGISTER_NAMES.length) {
      throw new Error(`Invalid register index ${idx}`)
    }
  }

  private assertAddr(addr: number, width: number) {
    if (addr < 0 || addr + width > this.memory.byteLength) {
      throw new RangeError(
        `Memory access out of range: addr=0x${addr.toString(16)} width=${width} (size=${this.memory.byteLength})`
      )
    }
  }

  private readReg(idx: number): number {
    this.assertReg(idx)
    return this.registers.getUint16(idx * 2)
  }

  private writeReg(idx: number, value: number) {
    this.assertReg(idx)
    this.registers.setUint16(idx * 2, u16(value))
  }

  private push(value: number) {
    const sp = this.readReg(regIndex('sp'))
    this.setWord(sp, value)
    this.writeReg(regIndex('sp'), sp - 2)
  }

  private readOperands<O extends Opcode>(opcode: O): OpcodeOperands[O] {
    const schema = INSTRUCTIONS[opcode].schema

    // Mutable tuple during construction
    const out = [] as unknown as {
      -readonly [K in keyof OpcodeOperands[O]]: OpcodeOperands[O][K]
    }

    schema.forEach((kind, i) => {
      let val: number
      if (kind === 'reg') {
        val = this.fetch() % REGISTER_NAMES.length
        out[i] = val as OpcodeOperands[O][typeof i]
      } else if (kind === 'lit16' || kind === 'addr16') {
        val = this.fetch16()
        out[i] = val as OpcodeOperands[O][typeof i]
      } else {
        val = this.fetch()
        out[i] = val as OpcodeOperands[O][typeof i]
      }
    })

    return out as OpcodeOperands[O]
  }

  private fetch(): number {
    const idx = regIndex('ip')
    const ip = this.readReg(idx)
    const byte = this.getByte(ip)
    this.writeReg(idx, u16(ip + 1))
    return byte
  }

  private fetch16(): number {
    const idx = regIndex('ip')
    const ip = this.readReg(idx)
    const word = this.getWord(ip)
    this.writeReg(idx, u16(ip + 2))
    return word
  }
}

export default CPU
