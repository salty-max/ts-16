import * as P from 'parsil'
import formats from './formats'
import {
  OpcodeForm,
  OPCODES_TABLE,
  type OpcodeKeyword,
  type OpcodeMeta,
  type OpcodeName,
} from '../../instructions'
import type { FormatParser } from './formats'

const FORM_PRIORITY: Partial<Record<OpcodeForm, number>> = {
  [OpcodeForm.REG_PTR_REG]: 90,
  [OpcodeForm.IMM_OFF_REG]: 85,
  [OpcodeForm.REG_MEM]: 80,
  [OpcodeForm.MEM_REG]: 79,
  [OpcodeForm.IMM_MEM]: 75,
  [OpcodeForm.IMM8_MEM]: 74,
  [OpcodeForm.REG_REG]: 60,
  [OpcodeForm.IMM_REG]: 55,
  [OpcodeForm.REG_IMM]: 54,
  [OpcodeForm.SINGLE_MEM]: 40,
  [OpcodeForm.SINGLE_REG]: 39,
  [OpcodeForm.SINGLE_IMM]: 38,
  [OpcodeForm.NO_ARGS]: 10,
}

const FORM_IMPL: Partial<Record<OpcodeForm, FormatParser>> = {
  [OpcodeForm.NO_ARGS]: formats.noArgs,
  [OpcodeForm.SINGLE_IMM]: formats.singleImm,
  [OpcodeForm.SINGLE_REG]: formats.singleReg,
  [OpcodeForm.SINGLE_MEM]: formats.singleMem,
  [OpcodeForm.IMM_REG]: formats.immReg,
  [OpcodeForm.REG_REG]: formats.regReg,
  [OpcodeForm.REG_MEM]: formats.regMem,
  [OpcodeForm.REG_IMM]: formats.regImm,
  [OpcodeForm.MEM_REG]: formats.memReg,
  [OpcodeForm.IMM_MEM]: formats.immMem,
  [OpcodeForm.IMM8_MEM]: formats.imm8Mem,
  [OpcodeForm.REG_PTR_REG]: formats.regPtrReg,
  [OpcodeForm.IMM_OFF_REG]: formats.immOffReg,
}

const metas = [...(Object.values(OPCODES_TABLE) as OpcodeMeta[])]
metas.sort(
  (a, b) =>
    a.keyword.localeCompare(b.keyword) ||
    (FORM_PRIORITY[b.form] ?? 0) - (FORM_PRIORITY[a.form] ?? 0)
)

const allInstructions = metas.map((meta) => {
  const build = FORM_IMPL[meta.form]
  if (!build) {
    throw new Error(
      `No format parser for form ${meta.form} (opcode ${meta.name})`
    )
  }
  return build(meta.keyword as OpcodeKeyword, meta.name as OpcodeName)
})

const choice = P.choice(allInstructions)
export default P.coroutine((run) => {
  run(P.optionalWhitespace)

  const node = run(choice)

  run(P.optionalWhitespace)
  run(P.endOfInput)

  return node
})
