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
  { code: 0x17, name: 'PSH_LIT', schema: ['lit16'] as const },
  { code: 0x18, name: 'PSH_REG', schema: ['reg'] as const },
  { code: 0x1b, name: 'ADD_REG_REG', schema: ['reg', 'reg'] as const },
  { code: 0x41, name: 'JMP_NOT_EQ', schema: ['lit16', 'addr16'] as const },
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
