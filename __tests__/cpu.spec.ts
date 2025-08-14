import { beforeEach, describe, expect, it } from 'bun:test'
import CPU from '../src/cpu'
import { OPCODES, OPERAND_SIZES } from '../src/instructions'
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
import { fmt16, regIndex } from '../src/util'

let cpu: CPU
let RET_ADDR: number
let FRAME_SZ_ADDR: number

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

describe('CAL_LIT @0x3000 / RET', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('saves registers + RA, jumps to 0x3000, subroutine tweaks r1, RET restores and resumes at RA', () => {
    const main = [
      OPCODES.MOV_LIT_REG,
      ...word(0x5555),
      regIndex('r1'),
      OPCODES.PSH_LIT,
      ...word(0x0000),
      OPCODES.CAL_LIT,
      ...word(0x3000),
      OPCODES.NO_OP,
    ]

    const sub = [
      OPCODES.MOV_LIT_REG,
      ...word(0xaaaa),
      regIndex('r1'),
      OPCODES.RET,
    ]

    loadProgram(cpu, [...main, ...padTo(0x3000, main.length), ...sub])

    stepAndShow(cpu, 'MOV_LIT_REG r1=0x5555')
    stepAndShow(cpu, 'PSH_LIT args')

    const ipBeforeCall = cpu.getRegister('ip')

    stepAndShow(cpu, 'CAL_LIT 0x3000')

    expectAfterCallInvariant(cpu)
    expectSavedRA(cpu, ipBeforeCall + 3)
    // IP jumped to subroutine
    expectReg(cpu, 'ip', 0x3000)

    stepAndShow(cpu, 'MOV_LIT_REG r1=0xAAAA')
    expectReg(cpu, 'r1', 0xaaaa, 'subroutine should update r1')
    stepAndShow(cpu, 'RET')

    expectReg(cpu, 'ip', ipBeforeCall + 3)
    expectReg(cpu, 'r1', 0x5555)
  })
})

describe('CAL_REG (r2=0x3000) / RET (save/restore full frame)', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  it('jumps via register to 0x3000 and restores caller state on RET', () => {
    const main = [
      OPCODES.MOV_LIT_REG,
      ...word(0x3000),
      regIndex('r2'),
      OPCODES.MOV_LIT_REG,
      ...word(0xdead),
      regIndex('r3'),
      OPCODES.PSH_LIT,
      ...word(0x0000),
      OPCODES.CAL_REG,
      regIndex('r2'),
      OPCODES.NO_OP,
    ]

    const sub = [
      OPCODES.MOV_LIT_REG,
      ...word(0xbeef),
      regIndex('r3'),
      OPCODES.RET,
    ]

    loadProgram(cpu, [...main, ...padTo(0x3000, main.length), ...sub])

    stepAndShow(cpu, 'MOV_LIT_REG r2=0x3000')
    stepAndShow(cpu, 'MOV_LIT_REG r3=0xDEAD')
    stepAndShow(cpu, 'PSH_LIT args')

    const ipBeforeCall = cpu.getRegister('ip')

    stepAndShow(cpu, 'CAL_REG r2')

    expectAfterCallInvariant(cpu)
    expectSavedRA(cpu, ipBeforeCall + 2)
    // IP jumped to subroutine
    expectReg(cpu, 'ip', 0x3000)

    stepAndShow(cpu, 'MOV_LIT_REG r3=0xBEEF')
    expectReg(cpu, 'r3', 0xbeef)
    stepAndShow(cpu, 'RET')

    expectReg(cpu, 'ip', ipBeforeCall + 2)
    expectReg(cpu, 'r3', 0xdead)
  })
})

describe('Full program with args + subroutine pushes', () => {
  let RET_ADDR: number

  beforeEach(() => {
    cpu = makeCPU()
  })

  it('runs main + subroutine exactly as in diagram', () => {
    const main = [
      OPCODES.PSH_LIT,
      ...word(0x3333),
      OPCODES.PSH_LIT,
      ...word(0x2222),
      OPCODES.PSH_LIT,
      ...word(0x1111),
      OPCODES.MOV_LIT_REG,
      ...word(0x1234),
      regIndex('r1'),
      OPCODES.MOV_LIT_REG,
      ...word(0x5678),
      regIndex('r4'),
      OPCODES.PSH_LIT,
      ...word(0x0000),
      OPCODES.CAL_LIT,
      ...word(0x3000),
      OPCODES.PSH_LIT,
      ...word(0x4444),
    ]

    const sub = [
      OPCODES.PSH_LIT,
      ...word(0x0102),
      OPCODES.PSH_LIT,
      ...word(0x0304),
      OPCODES.PSH_LIT,
      ...word(0x0506),
      OPCODES.MOV_LIT_REG,
      ...word(0x0708),
      regIndex('r1'),
      OPCODES.MOV_LIT_REG,
      ...word(0x090a),
      regIndex('r8'),
      OPCODES.RET,
    ]

    loadProgram(cpu, [...main, ...padTo(0x3000, main.length), ...sub])

    stepAndShow(cpu, 'PSH_LIT 0x3333')
    stepAndShow(cpu, 'PSH_LIT 0x2222')
    stepAndShow(cpu, 'PSH_LIT 0x1111')
    stepAndShow(cpu, 'MOV_LIT_REG 0x1234 -> r1')
    expectReg(cpu, 'r1', 0x1234)
    stepAndShow(cpu, 'MOV_LIT_REG 0x5678 -> r4')
    expectReg(cpu, 'r4', 0x5678)
    stepAndShow(cpu, 'PSH_LIT args')

    const ipBeforeCall = cpu.getRegister('ip')

    stepAndShow(cpu, 'CAL_LIT 0x3000')

    expectAfterCallInvariant(cpu)
    expectSavedRA(cpu, ipBeforeCall + 3)
    // IP jumped to subroutine
    expectReg(cpu, 'ip', 0x3000)

    stepAndShow(cpu, 'PSH_LIT 0x0102')
    stepAndShow(cpu, 'PSH_LIT 0x0304')
    stepAndShow(cpu, 'PSH_LIT 0x0506')
    stepAndShow(cpu, 'MOV_LIT_REG 0x0708 -> r1')
    expectReg(cpu, 'r1', 0x0708)
    stepAndShow(cpu, 'MOV_LIT_REG 0x090A -> r8')
    expectReg(cpu, 'r8', 0x090a)

    // Return to main
    stepAndShow(cpu, 'RET')
    expectReg(cpu, 'ip', ipBeforeCall + 3)
    expectReg(cpu, 'r1', 0x1234) // restored
    expectReg(cpu, 'r8', 0x0000) // restored

    // Final instruction in main
    stepAndShow(cpu, 'PSH_LIT 0x4444')
  })
})
