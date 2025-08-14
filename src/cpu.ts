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
import type MemoryMapper from './memory-mapper'

class CPU {
  private memory: MemoryMapper
  private prevRegisters: Record<RegName, number>
  private registers: Memory
  private stackFrameSize: number

  constructor(memory: MemoryMapper) {
    this.memory = memory
    this.registers = createMemory(REGISTER_NAMES.length * 2)
    this.stackFrameSize = 0
    this.writeReg(regIndex('sp'), memory.byteLength - 2)
    this.writeReg(regIndex('fp'), memory.byteLength - 2)

    // Snapshot the initial registers values
    this.prevRegisters = Object.fromEntries(
      REGISTER_NAMES.map((n) => [n, this.readReg(regIndex(n))])
    ) as Record<RegName, number>
  }

  getMemory(): MemoryMapper {
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

  execute<O extends Opcode>(opcode: O): boolean | void {
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
        const value = this.pop()
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
      case OPCODES.CAL_LIT: {
        const [addr] = this.readOperands(OPCODES.CAL_LIT)
        this.pushState()
        this.writeReg(regIndex('ip'), addr)
        return
      }
      case OPCODES.CAL_REG: {
        const [src] = this.readOperands(OPCODES.CAL_REG)
        const addr = this.readReg(src)
        this.pushState()
        this.writeReg(regIndex('ip'), addr)
        return
      }
      case OPCODES.RET: {
        this.popState()
        return
      }
      case OPCODES.NO_OP: {
        return
      }
      case OPCODES.HLT: {
        return true
      }
    }
  }

  step(): boolean {
    const opcode = this.fetchByte() as Opcode
    return Boolean(this.execute(opcode))
  }

  run() {
    const halt = this.step()
    if (!halt) {
      setImmediate(() => this.run())
    }
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
        `Memory access out of range: addr=${fmt16(addr)} width=${width} (size=${this.memory.byteLength})`
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
    const spAddr = this.readReg(regIndex('sp'))
    this.setWord(spAddr, value)
    this.writeReg(regIndex('sp'), spAddr - 2)
    this.stackFrameSize += 2
  }

  private pop(): number {
    const nextSpAddr = this.readReg(regIndex('sp')) + 2
    this.writeReg(regIndex('sp'), nextSpAddr)
    this.stackFrameSize -= 2
    return this.getWord(nextSpAddr)
  }

  private pushState() {
    // Save registers
    for (let i = 0; i < 8; i++) {
      this.push(this.readReg(regIndex(`r${i + 1}` as RegName)))
    }

    // Save return address
    this.push(this.readReg(regIndex('ip')))

    // Push stack frame size
    this.push(this.stackFrameSize + 2)

    // Update frame pointer and reset local pointer
    this.writeReg(regIndex('fp'), this.readReg(regIndex('sp')))
    this.stackFrameSize = 0
  }

  private popState() {
    // Restore stack pointer to frame base
    const fpAddr = this.readReg(regIndex('fp'))
    this.writeReg(regIndex('sp'), fpAddr)

    // Pop saved frame size
    this.stackFrameSize = this.pop()
    const frameSize = this.stackFrameSize

    // Pop return address and jump back
    this.writeReg(regIndex('ip'), this.pop())

    // Restore registers
    for (let i = 8; i > 0; i--) {
      this.writeReg(regIndex(`r${i}` as RegName), this.pop())
    }

    const nArgs = this.pop()
    for (let i = 0; i < nArgs; i++) {
      this.pop()
    }

    this.writeReg(regIndex('fp'), fpAddr + frameSize)
  }

  private readOperands<O extends Opcode>(opcode: O): OpcodeOperands[O] {
    const schema = INSTRUCTIONS[opcode].schema

    // Mutable tuple during construction
    const out = [] as unknown as {
      -readonly [K in keyof OpcodeOperands[O]]: OpcodeOperands[O][K]
    }

    schema.forEach((kind, i) => {
      let val: number
      switch (kind) {
        case 'reg': {
          val = this.fetchByte() % REGISTER_NAMES.length
          out[i] = val as OpcodeOperands[O][typeof i]
          break
        }
        case 'lit16':
        case 'addr16': {
          val = this.fetchWord()
          out[i] = val as OpcodeOperands[O][typeof i]
          break
        }
        default: {
          val = this.fetchByte()
          out[i] = val as OpcodeOperands[O][typeof i]
          break
        }
      }
    })

    return out as OpcodeOperands[O]
  }

  private fetchByte(): number {
    const ipIdx = regIndex('ip')
    const nextInstrAddr = this.readReg(ipIdx)
    const instr = this.getByte(nextInstrAddr)
    this.writeReg(ipIdx, nextInstrAddr + 1)
    return instr
  }

  private fetchWord(): number {
    const ipIdx = regIndex('ip')
    const nextInstrAddr = this.readReg(ipIdx)
    const instr = this.getWord(nextInstrAddr)
    this.writeReg(ipIdx, nextInstrAddr + 2)
    return instr
  }
}

export default CPU
