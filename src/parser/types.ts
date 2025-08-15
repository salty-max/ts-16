import type { OpcodeName } from '../instructions'
import type { RegName } from '../util'

export type Nested<T> = (T | Nested<T>)[]

export type OpPlusNode = {
  type: 'PLUS'
  value: '+'
}

export type OpMinusNode = {
  type: 'MINUS'
  value: '-'
}

export type OpFactorNode = {
  type: 'FACTOR'
  value: '*'
}

export type OperatorNode = OpPlusNode | OpMinusNode | OpFactorNode

export type RegNode = {
  type: 'REGISTER'
  value: RegName
}

export type HexNode = {
  type: 'HEX_LITERAL'
  value: number
  raw: string
}

export type AddrNode = {
  type: 'ADDR_LITERAL'
  value: number
  raw: string
}

export type VarNode = {
  type: 'VARIABLE'
  value: string
}

export type ArgNode = HexNode | VarNode

export type SqBrExprNode = {
  type: 'SQUARE_BRACKET_EXPR'
  expr: ExprToken[]
}

export type ParenExprNode = {
  type: 'PAREN_EXPR'
  expr: ExprToken[]
}

export type AddrExprNode = {
  type: 'ADDRESS'
  expr: AddrNode | SqBrExprNode
}

export type GroupNode = SqBrExprNode | ParenExprNode
export type OperandNode = HexNode | VarNode | GroupNode | BinaryOpNode
export type ExprToken = OperandNode | OperatorNode
export type ExprNode = RegNode | ArgNode | SqBrExprNode | AddrExprNode

export type BinaryOpNode = {
  type: 'BINARY_OP'
  a: OperandNode
  b: OperandNode
  op: OperatorNode
}

export type InstructionNode = {
  type: 'INSTRUCTION'
  opcode: OpcodeName
  args: ExprNode[]
}

export const asOpPlus = (value: '+'): OpPlusNode => ({
  type: 'PLUS',
  value,
})

export const asOpMinus = (value: '-'): OpMinusNode => ({
  type: 'MINUS',
  value,
})

export const asOpFactor = (value: '*'): OpFactorNode => ({
  type: 'FACTOR',
  value,
})

export const asRegister = (value: RegName): RegNode => ({
  type: 'REGISTER',
  value,
})

export const asHexLiteral = (raw: string): HexNode => ({
  type: 'HEX_LITERAL',
  value: parseInt(raw, 16),
  raw,
})

export const asAddrLiteral = (raw: string): AddrNode => ({
  type: 'ADDR_LITERAL',
  value: parseInt(raw, 16),
  raw,
})

export const asVariable = (value: string): VarNode => ({
  type: 'VARIABLE',
  value,
})

export const asSquareBracketExpr = (expr: ExprToken[]): SqBrExprNode => ({
  type: 'SQUARE_BRACKET_EXPR',
  expr,
})

export const asParenExpr = (expr: ExprToken[]): ParenExprNode => ({
  type: 'PAREN_EXPR',
  expr,
})

export const asBinaryOp = (
  a: OperandNode,
  b: OperandNode,
  op: OperatorNode
): BinaryOpNode => ({
  type: 'BINARY_OP',
  a,
  b,
  op,
})

export const asAddrExprNode = (
  expr: AddrNode | SqBrExprNode
): AddrExprNode => ({
  type: 'ADDRESS',
  expr,
})

export const asInstruction = ({
  opcode,
  args,
}: {
  opcode: OpcodeName
  args: ExprNode[]
}): InstructionNode => ({
  type: 'INSTRUCTION',
  opcode,
  args,
})

const isNested = (e: ExprToken | Nested<ExprToken>): e is Nested<ExprToken> =>
  Array.isArray(e)

export const isOperator = (t: ExprToken): t is OperatorNode =>
  t.type === 'PLUS' || t.type === 'MINUS' || t.type === 'FACTOR'

export function typeParenExpr(expr: Nested<ExprToken>): ParenExprNode {
  const inner = expr.map<ExprToken>((e) => (isNested(e) ? typeParenExpr(e) : e))
  return asParenExpr(inner)
}
