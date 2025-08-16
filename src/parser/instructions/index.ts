import * as P from 'parsil'
import formats from './formats'
import {
  OpcodeForm,
  OPCODES_TABLE,
  type OpcodeKeyword,
  type OpcodeMeta,
  type OpcodeName,
} from '../../instructions'

const FORM_PRIORITY: Partial<Record<OpcodeForm, number>> = {
  [OpcodeForm.REG_PTR_REG]: 90,
  [OpcodeForm.IMM_OFF_REG]: 85,
  [OpcodeForm.REG_MEM]: 80,
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
const metas = Object.values(OPCODES_TABLE) as OpcodeMeta[]
metas.sort(
  (a, b) =>
    a.keyword.localeCompare(b.keyword) ||
    (FORM_PRIORITY[b.form] ?? 0) - (FORM_PRIORITY[a.form] ?? 0)
)

const allInstructions = metas.map((meta) =>
  formats[meta.form](meta.keyword as OpcodeKeyword, meta.name as OpcodeName)
)

export default P.choice(allInstructions)
