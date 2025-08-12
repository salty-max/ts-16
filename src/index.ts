import { createMemory } from './memory'
import { OPCODES, type OpcodeName } from './instructions'
import CPU from './cpu'
import { regIndex } from './util'

function loadProgram(cpu: CPU, bytes: number[]) {
  const writableBytes = new Uint8Array(cpu.getMemory().buffer)
  writableBytes.set(bytes, 0)
}

const memory = createMemory(256 * 256)
const cpu = new CPU(memory)

// Define the test program as [opcode, operands...]
const program: number[] = [
  OPCODES.MOV_LIT_REG,
  0x12,
  0x34,
  regIndex('r1'),
  OPCODES.MOV_LIT_REG,
  0xab,
  0xcd,
  regIndex('r2'),
  OPCODES.ADD_REG_REG,
  regIndex('r1'),
  regIndex('r2'),
  OPCODES.MOV_REG_MEM,
  regIndex('acc'),
  0x01,
  0x00,
]

// Load and run
loadProgram(cpu, program)

cpu.debug()

cpu.step()
cpu.debugDiff({
  unchanged: 'dim',
  label: 'After MOV_LIT_REG r1',
})

cpu.step()
cpu.debugDiff({
  unchanged: 'dim',
  label: 'After MOV_LIT_REG r2',
})

cpu.step()
cpu.debugDiff({
  unchanged: 'dim',
  label: 'After ADD_REG_REG',
})

cpu.step()
cpu.viewMemoryAt(0x0100)
