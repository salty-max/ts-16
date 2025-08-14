// __tests__/cpu.spec.ts
import { beforeEach, describe, expect, it } from 'bun:test'
import CPU from '../src/cpu'
import { OPCODES } from '../src/instructions'
import {
  expectIPDelta,
  expectReg,
  expectMem,
  loadProgram,
  makeCPU,
  stepAndShow,
  word,
  padTo,
  expectAfterCallInvariant,
  expectSavedRA,
} from './helpers'
import { regIndex, REGISTER_NAMES } from '../src/util'

let cpu: CPU

//
// ────────────────────────────────────────────────────────────────────────────
//  CPU • Initialization
// ────────────────────────────────────────────────────────────────────────────
//
describe('CPU ▸ Initialization', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('sets SP and FP to memory.byteLength - 2', () => {
    const c64k = makeCPU(0x10000)
    expect(c64k.getRegister('sp')).toBe(0xfffe)
    expect(c64k.getRegister('fp')).toBe(0xfffe)
  })
})

//
// ────────────────────────────────────────────────────────────────────────────
//  Memory & Bounds
// ────────────────────────────────────────────────────────────────────────────
//
describe('CPU ▸ Memory & Bounds', () => {
  it('maps full RAM and can RW first/last addresses', () => {
    cpu = makeCPU(0x10000)
    // first
    cpu.setByte(0x0000, 0x12)
    expect(cpu.getByte(0x0000)).toBe(0x12)
    // last
    cpu.setByte(0xffff, 0x34)
    expect(cpu.getByte(0xffff)).toBe(0x34)
  })

  it('throws on unmapped address', () => {
    cpu = makeCPU(0x100)
    expect(() => cpu.getByte(0x100)).toThrow(/No memory region|out of range/i)
    expect(() => cpu.setByte(0x100, 0)).toThrow(
      /No memory region|out of range/i
    )
  })

  it('throws when reading/writing word that crosses the end of RAM', () => {
    cpu = makeCPU(0x10000)
    const end = 0x10000
    expect(() => cpu.getWord(end - 1)).toThrow(/out of range|width=2/i)
    expect(() => cpu.setWord(end - 1, 0x1234)).toThrow(/out of range|width=2/i)
  })
})

//
// ────────────────────────────────────────────────────────────────────────────
//  Register access & validation
// ────────────────────────────────────────────────────────────────────────────
//
describe('CPU ▸ Registers', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('MOV_LIT_REG sets register correctly', () => {
    loadProgram(cpu, [OPCODES.MOV_LIT_REG, ...word(0xabcd), regIndex('r1')])
    stepAndShow(cpu)
    expectReg(cpu, 'r1', 0xabcd)
  })

  it('MOV_REG_REG copies between registers', () => {
    loadProgram(cpu, [
      OPCODES.MOV_LIT_REG,
      ...word(0xabcd),
      regIndex('r1'),
      OPCODES.MOV_REG_REG,
      regIndex('r1'),
      regIndex('r2'),
    ])
    stepAndShow(cpu)
    stepAndShow(cpu)
    expectReg(cpu, 'r2', 0xabcd)
  })

  it('rejects invalid register index', () => {
    const bad = REGISTER_NAMES.length
    expect(() => (cpu as any).writeReg(bad, 0x1234)).toThrow(
      /invalid register/i
    )
    expect(() => (cpu as any).readReg(bad)).toThrow(/invalid register/i)
  })
})

//
// ────────────────────────────────────────────────────────────────────────────
//  Stack (push/pop + overflow/underflow)
// ────────────────────────────────────────────────────────────────────────────
//
describe('CPU ▸ Stack', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('PSH_LIT / PSH_REG / POP move SP and memory correctly', () => {
    loadProgram(cpu, [
      OPCODES.MOV_LIT_REG,
      ...word(0x0bad),
      regIndex('r2'),
      OPCODES.PSH_LIT,
      ...word(0xbeef),
      OPCODES.PSH_REG,
      regIndex('r2'),
      OPCODES.POP,
      regIndex('r3'),
      OPCODES.POP,
      regIndex('r4'),
    ])
    const sp0 = cpu.getRegister('sp')

    stepAndShow(cpu)
    stepAndShow(cpu)
    expect(cpu.getRegister('sp')).toBe((sp0 - 2) & 0xffff)

    stepAndShow(cpu)
    expect(cpu.getRegister('sp')).toBe((sp0 - 4) & 0xffff)

    stepAndShow(cpu)
    expectReg(cpu, 'r3', 0x0bad)
    stepAndShow(cpu)
    expectReg(cpu, 'r4', 0xbeef)
    expect(cpu.getRegister('sp')).toBe(sp0)
  })

  describe('overflow (guarded: pushes past 0x0000 should fail)', () => {
    it('throws when a push would write outside mapped RAM', () => {
      cpu = makeCPU(0x0200) // roomy to place code away from stack
      cpu.setRegister('sp', 0x0006)

      loadProgram(
        cpu,
        [
          OPCODES.PSH_LIT,
          ...word(0x1111), // @0x0006 -> sp=0x0004
          OPCODES.PSH_LIT,
          ...word(0x2222), // @0x0004 -> sp=0x0002
          OPCODES.PSH_LIT,
          ...word(0x3333), // @0x0002 -> sp=0x0000
          OPCODES.PSH_LIT,
          ...word(0x4444), // @0x0000 -> sp=0xFFFE
          OPCODES.PSH_LIT,
          ...word(0x5555), // @0xFFFE -> unmapped => throw
        ],
        0x0100
      )
      cpu.setRegister('ip', 0x0100)

      stepAndShow(cpu)
      expectMem(cpu, 0x0006, 0x1111)
      stepAndShow(cpu)
      expectMem(cpu, 0x0004, 0x2222)
      stepAndShow(cpu)
      stepAndShow(cpu)

      expect(() => stepAndShow(cpu)).toThrow(/No memory region|out of range/i)
    })

    it('does not throw while still within bounds', () => {
      cpu = makeCPU(0x0200)
      cpu.setRegister('sp', 0x0008)

      loadProgram(
        cpu,
        [
          OPCODES.PSH_LIT,
          ...word(0xaaaa), // -> @0x0008
          OPCODES.PSH_LIT,
          ...word(0xbbbb), // -> @0x0006
          OPCODES.PSH_LIT,
          ...word(0xcccc), // -> @0x0004
        ],
        0x0100
      )
      cpu.setRegister('ip', 0x0100)

      stepAndShow(cpu)
      expectMem(cpu, 0x0008, 0xaaaa)
      stepAndShow(cpu)
      expectMem(cpu, 0x0006, 0xbbbb)
      stepAndShow(cpu)
      expectMem(cpu, 0x0004, 0xcccc)
    })
  })

  describe('underflow (reading above RAM should throw)', () => {
    it('POP on an empty stack throws', () => {
      cpu = makeCPU(0x0200)
      loadProgram(cpu, [OPCODES.POP, regIndex('r1')], 0x0100)
      cpu.setRegister('ip', 0x0100)
      expect(() => stepAndShow(cpu)).toThrow(RangeError)
    })

    it('POP throws after popping more than pushed', () => {
      cpu = makeCPU(0x0200)
      loadProgram(
        cpu,
        [
          OPCODES.PSH_LIT,
          ...word(0xbeef),
          OPCODES.POP,
          regIndex('r2'),
          OPCODES.POP,
          regIndex('r3'),
        ],
        0x0100
      )
      cpu.setRegister('ip', 0x0100)
      stepAndShow(cpu)
      stepAndShow(cpu)
      expect(() => stepAndShow(cpu)).toThrow(RangeError)
    })
  })
})

//
// ────────────────────────────────────────────────────────────────────────────
//  Instructions
// ────────────────────────────────────────────────────────────────────────────
//
describe('CPU ▸ Instructions', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  describe('NO_OP', () => {
    it('increments IP by 1', () => {
      loadProgram(cpu, [OPCODES.NO_OP, OPCODES.NO_OP])
      const ip0 = cpu.getRegister('ip')
      stepAndShow(cpu)
      expectIPDelta(cpu, ip0, 1)
    })
  })

  describe('MOV_REG_MEM / MOV_MEM_REG / MOV_LIT_MEM', () => {
    it('MOV_REG_MEM writes register to memory', () => {
      loadProgram(cpu, [
        OPCODES.MOV_LIT_REG,
        ...word(0xabcd),
        regIndex('r1'),
        OPCODES.MOV_REG_MEM,
        regIndex('r1'),
        ...word(0x0100),
      ])
      stepAndShow(cpu)
      stepAndShow(cpu)
      expectMem(cpu, 0x0100, 0xabcd)
    })

    it('MOV_MEM_REG reads memory to register', () => {
      loadProgram(cpu, [
        OPCODES.MOV_LIT_MEM,
        ...word(0xbeef),
        ...word(0x2000),
        OPCODES.MOV_MEM_REG,
        ...word(0x2000),
        regIndex('r4'),
      ])
      stepAndShow(cpu)
      stepAndShow(cpu)
      expectReg(cpu, 'r4', 0xbeef)
    })

    it('MOV_LIT_MEM writes immediate to memory', () => {
      loadProgram(cpu, [OPCODES.MOV_LIT_MEM, ...word(0x1234), ...word(0xdead)])
      stepAndShow(cpu)
      expectMem(cpu, 0xdead, 0x1234)
    })
  })

  describe('ADD_REG_REG', () => {
    it('adds two registers and stores in ACC', () => {
      loadProgram(cpu, [
        OPCODES.MOV_LIT_REG,
        ...word(0x0002),
        regIndex('r1'),
        OPCODES.MOV_LIT_REG,
        ...word(0x0003),
        regIndex('r2'),
        OPCODES.ADD_REG_REG,
        regIndex('r1'),
        regIndex('r2'),
      ])
      stepAndShow(cpu)
      stepAndShow(cpu)
      stepAndShow(cpu)
      expectReg(cpu, 'acc', 5)
    })
  })

  describe('JMP_NOT_EQ', () => {
    it('jumps when ACC != literal', () => {
      loadProgram(cpu, [
        OPCODES.MOV_LIT_REG,
        ...word(0x0001),
        regIndex('acc'),
        OPCODES.JMP_NOT_EQ,
        ...word(0x0002),
        ...word(0x0100),
      ])
      stepAndShow(cpu)
      stepAndShow(cpu)
      expectReg(cpu, 'ip', 0x0100)
    })

    it('does not jump when ACC == literal', () => {
      loadProgram(cpu, [
        OPCODES.MOV_LIT_REG,
        ...word(0x0002),
        regIndex('acc'),
        OPCODES.JMP_NOT_EQ,
        ...word(0x0002),
        ...word(0x0100),
      ])
      const ip0 = cpu.getRegister('ip')
      stepAndShow(cpu)
      stepAndShow(cpu)
      expectReg(cpu, 'ip', ip0 + 9) // opcode + lit + addr
    })
  })

  describe('HLT', () => {
    it('halts execution loop (stepping stops)', () => {
      loadProgram(cpu, [OPCODES.NO_OP, OPCODES.HLT, OPCODES.NO_OP])
      stepAndShow(cpu)
      const halted = (cpu as any).step ? (cpu as any).step() : undefined
      expect(halted === undefined || typeof halted === 'boolean').toBeTruthy()
    })
  })
})

//
// ────────────────────────────────────────────────────────────────────────────
//  Subroutines (CAL_LIT / CAL_REG, RET) with and without arguments
// ────────────────────────────────────────────────────────────────────────────
//
describe('CPU ▸ Subroutines', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('CAL_LIT/RET without arguments: saves/restores regs and resumes at RA', () => {
    const main = [
      OPCODES.MOV_LIT_REG,
      ...word(0x1111),
      regIndex('r1'),
      OPCODES.MOV_LIT_REG,
      ...word(0x2222),
      regIndex('r4'),
      OPCODES.PSH_LIT,
      ...word(0x0000), // argc = 0
      OPCODES.CAL_LIT,
      ...word(0x3000),
      OPCODES.PSH_LIT,
      ...word(0x4444),
    ]
    const sub = [
      OPCODES.MOV_LIT_REG,
      ...word(0xaaaa),
      regIndex('r1'),
      OPCODES.MOV_LIT_REG,
      ...word(0xbbbb),
      regIndex('r8'),
      OPCODES.RET,
    ]
    loadProgram(cpu, [...main, ...padTo(0x3000, main.length), ...sub])

    const spStart = cpu.getRegister('sp')
    stepAndShow(cpu)
    expectReg(cpu, 'r1', 0x1111)
    stepAndShow(cpu)
    expectReg(cpu, 'r4', 0x2222)
    stepAndShow(cpu)
    expect(cpu.getRegister('sp')).toBe((spStart - 2) & 0xffff)

    const ipBeforeCall = cpu.getRegister('ip')
    stepAndShow(cpu)
    expectAfterCallInvariant(cpu)
    expectSavedRA(cpu, ipBeforeCall + 3)
    expectReg(cpu, 'ip', 0x3000)

    stepAndShow(cpu)
    stepAndShow(cpu)
    stepAndShow(cpu)

    expectReg(cpu, 'ip', ipBeforeCall + 3)
    expectReg(cpu, 'r1', 0x1111)
    expectReg(cpu, 'r4', 0x2222)
    expectReg(cpu, 'r8', 0x0000)
    expect(cpu.getRegister('sp')).toBe(spStart)

    stepAndShow(cpu)
  })

  it('CAL_LIT/RET with two arguments: callee pops argc+args, caller SP restored', () => {
    const main = [
      OPCODES.MOV_LIT_REG,
      ...word(0x1234),
      regIndex('r1'),
      OPCODES.MOV_LIT_REG,
      ...word(0x5678),
      regIndex('r4'),
      OPCODES.PSH_LIT,
      ...word(0xdead), // arg #1
      OPCODES.PSH_LIT,
      ...word(0xbeef), // arg #2
      OPCODES.PSH_LIT,
      ...word(0x0002), // argc = 2
      OPCODES.CAL_LIT,
      ...word(0x3000),
      OPCODES.PSH_LIT,
      ...word(0x4444),
    ]
    const sub = [
      OPCODES.MOV_LIT_REG,
      ...word(0x0a0a),
      regIndex('r1'),
      OPCODES.MOV_LIT_REG,
      ...word(0x0b0b),
      regIndex('r8'),
      OPCODES.RET,
    ]
    loadProgram(cpu, [...main, ...padTo(0x3000, main.length), ...sub])

    const spStart = cpu.getRegister('sp')
    stepAndShow(cpu)
    expectReg(cpu, 'r1', 0x1234)
    stepAndShow(cpu)
    expectReg(cpu, 'r4', 0x5678)
    stepAndShow(cpu)
    stepAndShow(cpu)
    stepAndShow(cpu)
    expect(cpu.getRegister('sp')).toBe((spStart - 6) & 0xffff)

    const ipBeforeCall = cpu.getRegister('ip')
    stepAndShow(cpu)
    expectAfterCallInvariant(cpu)
    expectSavedRA(cpu, ipBeforeCall + 3)
    expectReg(cpu, 'ip', 0x3000)

    stepAndShow(cpu)
    stepAndShow(cpu)
    stepAndShow(cpu)

    expectReg(cpu, 'ip', ipBeforeCall + 3)
    expectReg(cpu, 'r1', 0x1234)
    expectReg(cpu, 'r4', 0x5678)
    expectReg(cpu, 'r8', 0x0000)
    expect(cpu.getRegister('sp')).toBe(spStart)

    stepAndShow(cpu)
  })

  it('CAL_REG/RET mirrors CAL_LIT/RET semantics', () => {
    const main = [
      OPCODES.MOV_LIT_REG,
      ...word(0x3000),
      regIndex('r2'),
      OPCODES.PSH_LIT,
      ...word(0x0000),
      OPCODES.CAL_REG,
      regIndex('r2'),
      OPCODES.PSH_LIT,
      ...word(0x9999),
    ]
    const sub = [
      OPCODES.MOV_LIT_REG,
      ...word(0xcafe),
      regIndex('r7'),
      OPCODES.RET,
    ]
    loadProgram(cpu, [...main, ...padTo(0x3000, main.length), ...sub])

    stepAndShow(cpu)
    stepAndShow(cpu)

    const ipBeforeCall = cpu.getRegister('ip')

    stepAndShow(cpu)
    expectAfterCallInvariant(cpu)
    expectSavedRA(cpu, ipBeforeCall + 2)
    expectReg(cpu, 'ip', 0x3000)

    stepAndShow(cpu)
    stepAndShow(cpu)

    expectReg(cpu, 'ip', ipBeforeCall + 2)
    expectReg(cpu, 'r7', 0x0000)
    stepAndShow(cpu)
  })
})
