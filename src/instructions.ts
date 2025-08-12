export type OpType = 'reg' | 'lit8' | 'lit16' | 'addr8' | 'addr16'

export interface Instruction<N extends string, C extends number> {
  code: C
  name: N
  schema: readonly OpType[]
}

const defs = [
  { code: 0x10, name: 'MOV_LIT_REG', schema: ['lit16', 'reg'] },
  { code: 0x11, name: 'MOV_REG_REG', schema: ['reg', 'reg'] },
  { code: 0x12, name: 'MOV_REG_MEM', schema: ['reg', 'addr16'] },
  { code: 0x13, name: 'MOV_MEM_REG', schema: ['addr16', 'reg'] },
  { code: 0x14, name: 'MOV_LIT_MEM', schema: ['lit16', 'addr16'] },
  { code: 0x1b, name: 'ADD_REG_REG', schema: ['reg', 'reg'] },
] as const satisfies readonly Instruction<string, number>[]

export type OpcodeName = (typeof defs)[number]['name']
export type OpcodeValue = (typeof defs)[number]['code']

export const OPCODES = Object.fromEntries(
  defs.map((d) => [d.name, d.code])
) as { [I in (typeof defs)[number] as I['name']]: I['code'] }

export const INSTRUCTIONS: Record<OpcodeValue, (typeof defs)[number]> =
  Object.fromEntries(defs.map((d) => [d.code, d])) as {
    [I in (typeof defs)[number] as I['code']]: I
  }

export type RegIndex = number & { readonly __brand: 'RegIndex' }

export type OpTs<T extends OpType> = T extends 'reg' ? RegIndex : number

export type MapSchema<S extends readonly OpType[]> = {
  [K in keyof S]: OpTs<S[K]>
}

export type OpcodeSchema = {
  [K in OpcodeValue]: MapSchema<(typeof INSTRUCTIONS)[K]['schema']>
}

export const OPERAND_SIZES: Record<OpcodeValue, number> = Object.fromEntries(
  defs.map((d) => [d.code, d.schema.reduce((sum, t) => sum + opSize(t), 0)])
) as Record<OpcodeValue, number>

function opSize(type: OpType): number {
  switch (type) {
    case 'reg':
    case 'lit8':
    case 'addr8':
      return 1
    case 'lit16':
    case 'addr16':
      return 2
  }
}
