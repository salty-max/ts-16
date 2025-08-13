import readline from 'readline'
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
  OPCODES.MOV_MEM_REG,
  0x01,
  0x00,
  regIndex('r1'),
  OPCODES.MOV_LIT_REG,
  0x00,
  0x01,
  regIndex('r2'),
  OPCODES.ADD_REG_REG,
  regIndex('r1'),
  regIndex('r2'),
  OPCODES.MOV_REG_MEM,
  regIndex('acc'),
  0x01,
  0x00,
  OPCODES.JMP_NOT_EQ,
  0x00,
  0x03,
  0x00,
  0x00,
]

// Load and run
loadProgram(cpu, program)

cpu.debug()
cpu.viewMemoryAt(cpu.getRegister('ip'))
cpu.viewMemoryAt(0x0100)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

rl.on('line', () => {
  cpu.step()
  cpu.debugDiff({
    unchanged: 'dim',
  })
  cpu.viewMemoryAt(cpu.getRegister('ip'))
  cpu.viewMemoryAt(0x0100)
})
