import { createMemory } from './memory'
import { INSTRUCTIONS } from './instructions'
import CPU from './cpu'

const memory = createMemory(256)
const writableBytes = new Uint8Array(memory.buffer)

writableBytes[0] = INSTRUCTIONS.MOV_LIT_R1
writableBytes[1] = 0x12
writableBytes[2] = 0x34
writableBytes[3] = INSTRUCTIONS.MOV_LIT_R2
writableBytes[4] = 0xab
writableBytes[5] = 0xcd
writableBytes[6] = INSTRUCTIONS.ADD_REG_REG
writableBytes[7] = 2
writableBytes[8] = 3

const cpu = new CPU(memory)

cpu.debug()

cpu.step()
cpu.debugDiff({
  unchanged: 'dim',
  label: 'Add to r1',
})

cpu.step()
cpu.debug({
  arrows: true,
})

cpu.step()
cpu.debug({
  arrows: true,
})
