export type OperandKind = 'reg' | 'lit8' | 'lit16' | 'addr8' | 'addr16'

export interface Instruction<
  N extends string,
  C extends number,
  S extends readonly OperandKind[],
> {
  code: C
  name: N
  schema: S
}

export type RegIndex = number & { readonly __brand: 'RegIndex' }
export type OperandValue<T extends OperandKind> = T extends 'reg'
  ? RegIndex
  : number
export type OperandsFrom<S extends readonly OperandKind[]> = {
  [K in keyof S]: OperandValue<S[K]>
}

const defs = [
  { code: 0x00, name: 'NO_OP', schema: [] as const },
  { code: 0x10, name: 'MOV_LIT_REG', schema: ['lit16', 'reg'] as const },
  { code: 0x11, name: 'MOV_REG_REG', schema: ['reg', 'reg'] as const },
  { code: 0x12, name: 'MOV_REG_MEM', schema: ['reg', 'addr16'] as const },
  { code: 0x13, name: 'MOV_MEM_REG', schema: ['addr16', 'reg'] as const },
  { code: 0x14, name: 'MOV_LIT_MEM', schema: ['lit16', 'addr16'] as const },
  { code: 0x15, name: 'MOV_REG_PTR_REG', schema: ['reg', 'reg'] as const },
  {
    code: 0x16,
    name: 'MOV_LIT_OFF_REG',
    schema: ['addr16', 'reg', 'reg'] as const,
  },
  { code: 0x17, name: 'PSH_LIT', schema: ['lit16'] as const },
  { code: 0x18, name: 'PSH_REG', schema: ['reg'] as const },
  { code: 0x1a, name: 'POP', schema: ['reg'] as const },
  { code: 0x1b, name: 'ADD_LIT_REG', schema: ['lit16', 'reg'] as const },
  { code: 0x1c, name: 'ADD_REG_REG', schema: ['reg', 'reg'] as const },
  { code: 0x1d, name: 'SUB_LIT_REG', schema: ['lit16', 'reg'] as const },
  { code: 0x1e, name: 'SUB_REG_LIT', schema: ['reg', 'lit16'] as const },
  { code: 0x1f, name: 'SUB_REG_REG', schema: ['reg', 'reg'] as const },
  { code: 0x20, name: 'MUL_LIT_REG', schema: ['lit16', 'reg'] as const },
  { code: 0x21, name: 'MUL_REG_REG', schema: ['reg', 'reg'] as const },
  { code: 0x26, name: 'LSH_REG_LIT', schema: ['reg', 'lit16'] as const },
  { code: 0x27, name: 'LSH_REG_REG', schema: ['reg', 'reg'] as const },
  { code: 0x2a, name: 'RSH_REG_LIT', schema: ['reg', 'lit16'] as const },
  { code: 0x2b, name: 'RSH_REG_REG', schema: ['reg', 'reg'] as const },
  { code: 0x2e, name: 'AND_REG_LIT', schema: ['reg', 'lit16'] as const },
  { code: 0x2f, name: 'AND_REG_REG', schema: ['reg', 'reg'] as const },
  { code: 0x30, name: 'OR_REG_LIT', schema: ['reg', 'lit16'] as const },
  { code: 0x31, name: 'OR_REG_REG', schema: ['reg', 'reg'] as const },
  { code: 0x32, name: 'XOR_REG_LIT', schema: ['reg', 'lit16'] as const },
  { code: 0x33, name: 'XOR_REG_REG', schema: ['reg', 'reg'] as const },
  { code: 0x34, name: 'NOT', schema: ['reg'] as const },
  { code: 0x35, name: 'INC_REG', schema: ['reg'] as const },
  { code: 0x36, name: 'DEC_REG', schema: ['reg'] as const },
  { code: 0x3e, name: 'JEQ_REG', schema: ['reg', 'addr16'] as const },
  { code: 0x3f, name: 'JEQ_LIT', schema: ['lit16', 'addr16'] as const },
  { code: 0x40, name: 'JNE_REG', schema: ['reg', 'addr16'] as const },
  { code: 0x41, name: 'JNE_LIT', schema: ['lit16', 'addr16'] as const },
  { code: 0x42, name: 'JLT_REG', schema: ['reg', 'addr16'] as const },
  { code: 0x43, name: 'JLT_LIT', schema: ['lit16', 'addr16'] as const },
  { code: 0x44, name: 'JGT_REG', schema: ['reg', 'addr16'] as const },
  { code: 0x45, name: 'JGT_LIT', schema: ['lit16', 'addr16'] as const },
  { code: 0x46, name: 'JLE_REG', schema: ['reg', 'addr16'] as const },
  { code: 0x47, name: 'JLE_LIT', schema: ['lit16', 'addr16'] as const },
  { code: 0x48, name: 'JGE_REG', schema: ['reg', 'addr16'] as const },
  { code: 0x49, name: 'JGE_LIT', schema: ['lit16', 'addr16'] as const },
  { code: 0x5e, name: 'CAL_LIT', schema: ['addr16'] as const },
  { code: 0x5f, name: 'CAL_REG', schema: ['reg'] as const },
  { code: 0x60, name: 'RET', schema: [] as const },
  { code: 0xff, name: 'HLT', schema: [] as const },
] as const

export type OpcodeDef = (typeof defs)[number]
export type OpcodeName = OpcodeDef['name']
export type Opcode = OpcodeDef['code']

export const OPCODES = Object.fromEntries(
  defs.map((d) => [d.name, d.code])
) as {
  [I in OpcodeName]: Extract<OpcodeDef, { name: I }>['code']
}

export const INSTRUCTIONS = Object.fromEntries(
  defs.map((d) => [d.code, d])
) as {
  [I in Opcode]: Extract<OpcodeDef, { code: I }>
}

export const OPERAND_SIZES: Record<Opcode, number> = Object.fromEntries(
  defs.map((d) => [
    d.code,
    d.schema.reduce(
      (sum, t) => sum + (t === 'lit16' || t === 'addr16' ? 2 : 1),
      0
    ),
  ])
) as Record<Opcode, number>

// Derive tuple type for each opcode
export type OpcodeOperands = {
  [K in Opcode]: OperandsFrom<(typeof INSTRUCTIONS)[K]['schema']>
}
