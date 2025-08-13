import { beforeEach, describe, it } from 'bun:test'
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
} from './helpers'
import { regIndex } from '../src/util'

let cpu: CPU

describe('NO_OP', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('advances IP by 1 and leaves registers unchanged', () => {
    const before = {
      ip: cpu.getRegister('ip'),
      acc: cpu.getRegister('acc'),
      r1: cpu.getRegister('r1'),
    }

    loadProgram(cpu, [OPCODES.NO_OP])
    stepAndShow(cpu, 'NO_OP')

    expectIPDelta(cpu, before.ip, 1, 'NO_OP should advance IP by 1')
    expectReg(cpu, 'acc', before.acc, 'ACC unchanged after NO_OP')
    expectReg(cpu, 'r1', before.r1, 'R1 unchanged after NO_OP')
  })
})

describe('MOV_LIT_REG', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('moves literal into register', () => {
    loadProgram(cpu, [OPCODES.MOV_LIT_REG, ...word(0x1234), regIndex('r1')])
    stepAndShow(cpu, 'MOV_LIT_REG')
    expectReg(cpu, 'r1', 0x1234)
  })
})

describe('MOV_REG_REG', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('copies src register to dst register', () => {
    loadProgram(cpu, [
      OPCODES.MOV_LIT_REG,
      ...word(0xabcd),
      regIndex('r1'),
      OPCODES.MOV_REG_REG,
      regIndex('r1'),
      regIndex('r2'),
    ])
    stepAndShow(cpu, 'MOV_LIT_R1')
    stepAndShow(cpu, 'MOV_REG_REG')
    expectReg(cpu, 'r2', 0xabcd)
  })
})

describe('MOV_REG_MEM', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('writes register value to memory address', () => {
    loadProgram(cpu, [
      OPCODES.MOV_LIT_REG,
      ...word(0xbeef),
      regIndex('r1'),
      OPCODES.MOV_REG_MEM,
      regIndex('r1'),
      ...word(0x0100),
    ])
    stepAndShow(cpu, 'MOV_LIT_R1')
    stepAndShow(cpu, 'MOV_REG_MEM', { memAt: 0x0100 })
    expectMem(cpu, 0x0100, 0xbeef, 'MOV_REG_MEM should store word at 0x0100')
  })
})

describe('MOV_MEM_REG', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('reads a value from memory into a register', () => {
    loadProgram(cpu, [
      OPCODES.MOV_LIT_MEM,
      ...word(0xcafe),
      ...word(0x0100),
      OPCODES.MOV_MEM_REG,
      ...word(0x0100),
      regIndex('r1'),
    ])

    stepAndShow(cpu, 'MOV_LIT_MEM', { memAt: 0x0100 })
    expectMem(cpu, 0x0100, 0xcafe, 'precondition: word at 0x0100')

    stepAndShow(cpu, 'MOV_MEM_REG')
    expectReg(cpu, 'r1', 0xcafe)
  })
})

describe('MOV_LIT_MEM', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('writes literal value to memory address', () => {
    loadProgram(cpu, [OPCODES.MOV_LIT_MEM, ...word(0xface), ...word(0x0100)])
    stepAndShow(cpu, 'MOV_LIT_MEM', { memAt: 0x0100 })
    expectMem(cpu, 0x0100, 0xface, 'MOV_LIT_MEM should store word at 0x0100')
  })
})

describe('PSH_LIT', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('pushes literal onto the stack', () => {
    loadProgram(cpu, [OPCODES.PSH_LIT, ...word(0x1234)])
    stepAndShow(cpu, 'PSH_LIT', { memAt: 0xfffe })
    expectMem(cpu, 0xfffe, 0x1234, 'stack top after PSH_LIT')
  })
})

describe('PSH_REG', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('pushes register value onto the stack', () => {
    loadProgram(cpu, [
      OPCODES.MOV_LIT_REG,
      ...word(0xabcd),
      regIndex('r1'),
      OPCODES.PSH_REG,
      regIndex('r1'),
    ])
    stepAndShow(cpu, 'MOV_LIT_REG')
    stepAndShow(cpu, 'PSH_REG', { memAt: 0xfffe })
    expectMem(cpu, 0xfffe, 0xabcd, 'stack top after PSH_REG')
  })
})

describe('POP', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('pops the top value from the stack into a register', () => {
    loadProgram(cpu, [
      OPCODES.PSH_LIT,
      ...word(0xbeef),
      OPCODES.POP,
      regIndex('acc'),
    ])
    stepAndShow(cpu, 'PSH_LIT', { memAt: 0xfffe })
    stepAndShow(cpu, 'POP')
    expectReg(cpu, 'acc', 0xbeef)
  })
})

describe('ADD_REG_REG', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('adds two registers into ACC', () => {
    loadProgram(cpu, [
      OPCODES.MOV_LIT_REG,
      ...word(0x0001),
      regIndex('r1'),
      OPCODES.MOV_LIT_REG,
      ...word(0x0002),
      regIndex('r2'),
      OPCODES.ADD_REG_REG,
      regIndex('r1'),
      regIndex('r2'),
    ])
    stepAndShow(cpu, 'MOV_LIT_R1')
    stepAndShow(cpu, 'MOV_LIT_R2')
    stepAndShow(cpu, 'ADD_REG_REG')
    expectReg(cpu, 'acc', 0x0003)
  })
})

describe('JMP_NOT_EQ', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('jumps when ACC != literal', () => {
    const ip0 = cpu.getRegister('ip')
    loadProgram(cpu, [
      OPCODES.MOV_LIT_REG,
      ...word(0x1111),
      regIndex('acc'),
      OPCODES.JMP_NOT_EQ,
      ...word(0x2222),
      ...word(0x0100),
    ])
    stepAndShow(cpu, 'MOV_LIT_ACC')
    stepAndShow(cpu, 'JMP_NOT_EQ taken')
    // For taken-branch we expect IP to be the target, not a delta
    expectReg(cpu, 'ip', 0x0100)
  })

  it('does not jump when ACC == literal', () => {
    const ip0 = cpu.getRegister('ip')
    loadProgram(cpu, [
      OPCODES.MOV_LIT_REG,
      ...word(0x2222),
      regIndex('acc'),
      OPCODES.JMP_NOT_EQ,
      ...word(0x2222),
      ...word(0x0100),
    ])
    stepAndShow(cpu, 'MOV_LIT_ACC')
    stepAndShow(cpu, 'JMP_NOT_EQ not taken')
    // MOV_LIT_REG (4 bytes) + JMP_NOT_EQ (1 + 2 + 2 = 5) => +9 total
    expectIPDelta(cpu, ip0, 9, 'JMP_NOT_EQ (not taken) should fall through')
  })
})
