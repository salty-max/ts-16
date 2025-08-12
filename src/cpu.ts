import { createMemory, type Memory } from './memory'
import {
  INSTRUCTIONS,
  OPCODES,
  type MapSchema,
  type OpcodeSchema,
  type OpcodeValue,
  type OpType,
  type RegIndex,
} from './instructions'
import { REGISTER_NAMES, type RegName } from './util/register'
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

class CPU {
  private memory: Memory
  private prevRegisters: Record<RegName, number>
  private registers: Memory
  private registerMap: Record<RegName, number>
  private ipIndex: number
  private accIndex: number

  constructor(memory: Memory) {
    this.memory = memory

    this.registers = createMemory(REGISTER_NAMES.length * 2)
    this.registerMap = REGISTER_NAMES.reduce(
      (map, name, i) => {
        map[name] = i * 2
        return map
      },
      {} as Record<RegName, number>
    )

    this.ipIndex = (this.registerMap['ip'] ?? 0) / 2
    this.accIndex = (this.registerMap['acc'] ?? 0) / 2

    // Seed snapshots so diffs aren't all "changed" on first print
    this.prevRegisters = Object.fromEntries(
      REGISTER_NAMES.map((n) => [n, this.getRegister(n)])
    ) as Record<RegName, number>
  }

  getMemory(): Memory {
    return this.memory
  }

  getRegister(name: RegName): number {
    return this.registers.getUint16(this.getOffset(name))
  }

  setRegister(name: RegName, value: number) {
    return this.registers.setUint16(this.getOffset(name), u16(value))
  }

  execute<O extends OpcodeValue>(opcode: O) {
    const def = INSTRUCTIONS[opcode]
    const ops = this.readOperands(def.schema) as OpcodeSchema[O]

    switch (opcode) {
      case OPCODES.MOV_LIT_REG: {
        // [opcode][lit_hi][lit_lo][dstReg]
        const [lit16, dstReg] = ops
        this.writeReg(dstReg, lit16)
        return
      }
      case OPCODES.MOV_REG_REG: {
        // [opcode][srcReg][dstReg]
        const [srcReg, dstReg] = ops
        this.writeReg(dstReg, this.readReg(srcReg))
        return
      }
      case OPCODES.MOV_REG_MEM: {
        const [srcReg, addr16] = ops
        this.memory.setUint16(addr16, this.readReg(srcReg))
        return
      }
      case OPCODES.MOV_MEM_REG: {
        const [addr, dstReg] = ops
        const value = this.memory.getUint16(addr)
        this.writeReg(dstReg, value)
        return
      }
      case OPCODES.MOV_LIT_MEM: {
        const [lit16, addr16] = ops
        this.memory.setUint16(addr16, lit16)
        return
      }
      case OPCODES.ADD_REG_REG: {
        // [opcode][aReg][bReg] => acc
        const [aReg, bReg] = ops
        const sum = this.readReg(aReg) + this.readReg(bReg)
        this.writeReg(this.accIndex, sum)
        return
      }
    }
  }

  step() {
    const opcode = this.fetch() as OpcodeValue
    this.execute(opcode)
  }

  debug(opts: { diffOnly?: boolean; arrows?: boolean } = {}) {
    let out = ''

    REGISTER_NAMES.forEach((name, i) => {
      const cur = this.getRegister(name)
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

      // old (red) then new (green), like a unified diff
      out += `${ANSI_RED}-${name.padEnd(nameWidth)}: ${fmt16(prev)}${ANSI_RESET}\n`
      out += `${ANSI_GREEN}+${name.padEnd(nameWidth)}: ${fmt16(cur)}${ANSI_RESET}\n`
    }

    console.log(out.trimEnd() + '\n')

    this.prevRegisters = curr
  }

  viewMemoryAt(addr: number, length = 8) {
    const bytes = Array.from({ length }, (_, i) =>
      this.memory.getUint8(addr + i)
    )

    // Hex column
    const hexCol = bytes
      .map((v) =>
        v === 0
          ? `${ANSI_DIM}00${ANSI_RESET}`
          : `${ANSI_GREEN}${v.toString(16).padStart(2, '0')}${ANSI_RESET}`
      )
      .join(' ')

    // ASCII column (printable chars only)
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

  private readReg(idx: number): number {
    this.assertReg(idx)
    return this.registers.getUint16(idx * 2)
  }

  private writeReg(idx: number, value: number) {
    this.assertReg(idx)
    this.registers.setUint16(idx * 2, u16(value))
  }

  private readOperand(kind: OpType): number | RegIndex {
    switch (kind) {
      case 'reg':
        return (this.fetch() % REGISTER_NAMES.length) as RegIndex
      case 'lit8':
      case 'addr8':
        return this.fetch()
      case 'lit16':
      case 'addr16':
        return this.fetch16()
    }
  }

  private readOperands<S extends readonly OpType[]>(schema: S): MapSchema<S> {
    const out: unknown[] = []
    for (const kind of schema) out.push(this.readOperand(kind))
    return out as MapSchema<S>
  }

  private fetch(): number {
    const ip = this.readReg(this.ipIndex)
    const byte = this.memory.getUint8(ip)
    this.writeReg(this.ipIndex, u16(ip + 1))
    return byte
  }

  private fetch16(): number {
    const ip = this.readReg(this.ipIndex)
    const word = this.memory.getUint16(ip)
    this.writeReg(this.ipIndex, u16(ip + 2))
    return word
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
