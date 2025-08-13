import { beforeEach, describe, expect, it } from 'bun:test'
import CPU from '../src/cpu'
import { OPCODES } from '../src/instructions'
import { expectReg, loadProgram, makeCPU, stepAndShow, word } from './helpers'
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

    expectReg(cpu, 'ip', before.ip + 1)
    expectReg(cpu, 'acc', before.acc)
    expectReg(cpu, 'r1', before.r1)
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
    cpu.setRegister('r1', 0xabcd)
    loadProgram(cpu, [OPCODES.MOV_REG_REG, regIndex('r1'), regIndex('r2')])
    stepAndShow(cpu, 'MOV_REG_REG')
    expectReg(cpu, 'r2', 0xabcd)
  })
})

describe('MOV_REG_MEM', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('writes register value to memory address', () => {
    cpu.setRegister('r1', 0xbeef)
    loadProgram(cpu, [OPCODES.MOV_REG_MEM, regIndex('r1'), ...word(0x0100)])
    stepAndShow(cpu, 'MOV_REG_MEM', { memAt: 0x0100 })
    expect(cpu.getMemory().getUint16(0x0100)).toBe(0xbeef)
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

    stepAndShow(cpu, 'MOV_LIT_MEM')
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
    expect(cpu.getMemory().getUint16(0x0100)).toBe(0xface)
  })
})

describe('PSH_LIT', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('pushes literal onto the stack', () => {
    cpu.setRegister('sp', 0xfffe)
    loadProgram(cpu, [OPCODES.PSH_LIT, ...word(0x1234)])
    stepAndShow(cpu, 'PSH_LIT', { memAt: 0xfffe })
    expect(cpu.getMemory().getUint16(0xfffe)).toBe(0x1234)
  })
})

describe('PSH_REG', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('pushes register value onto the stack', () => {
    cpu.setRegister('sp', 0xfffe)
    cpu.setRegister('r1', 0xabcd)
    loadProgram(cpu, [OPCODES.PSH_REG, regIndex('r1')])
    stepAndShow(cpu, 'PSH_REG', { memAt: 0xfffe })
    expect(cpu.getMemory().getUint16(0xfffe)).toBe(0xabcd)
  })
})

describe('ADD_REG_REG', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('adds two registers into ACC', () => {
    cpu.setRegister('r1', 0x0001)
    cpu.setRegister('r2', 0x0002)
    loadProgram(cpu, [OPCODES.ADD_REG_REG, regIndex('r1'), regIndex('r2')])
    stepAndShow(cpu, 'ADD_REG_REG')
    expectReg(cpu, 'acc', 0x0003)
  })
})

describe('JMP_NOT_EQ', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('jumps when ACC != literal', () => {
    cpu.setRegister('acc', 0x1111)
    loadProgram(cpu, [OPCODES.JMP_NOT_EQ, ...word(0x2222), ...word(0x0100)])
    stepAndShow(cpu, 'JMP_NOT_EQ taken')
    expectReg(cpu, 'ip', 0x0100)
  })

  it('does not jump when ACC == literal', () => {
    cpu.setRegister('acc', 0x2222)
    const ip0 = cpu.getRegister('ip')
    loadProgram(cpu, [OPCODES.JMP_NOT_EQ, ...word(0x2222), ...word(0x0100)])
    stepAndShow(cpu, 'JMP_NOT_EQ not taken')
    expectReg(cpu, 'ip', ip0 + 5) // opcode(1) + lit16(2) + addr16(2)
  })
})
