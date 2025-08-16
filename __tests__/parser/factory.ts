import {
  type HexNode,
  type VarNode,
  type OpPlusNode,
  type OpMinusNode,
  type OpFactorNode,
  type OperatorNode,
  type OperandNode,
  type BinaryOpNode,
  type SqBrExprNode,
  type ParenExprNode,
} from '../../src/parser/types'

export const HEX = (raw: string): HexNode => ({
  type: 'HEX_LITERAL',
  raw,
  value: parseInt(raw, 16),
})

export const VAR = (name: string): VarNode => ({
  type: 'VARIABLE',
  value: name,
})

export const PLUS: OpPlusNode = { type: 'PLUS', value: '+' }
export const MINUS: OpMinusNode = { type: 'MINUS', value: '-' }
export const FACTOR: OpFactorNode = { type: 'FACTOR', value: '*' }

export const BIN = (
  a: OperandNode,
  op: OperatorNode,
  b: OperandNode
): BinaryOpNode => ({
  type: 'BINARY_OP',
  a,
  op,
  b,
})

/** Folded groups (what your parser emits after precedence folding) */
export const SQ1 = (n: OperandNode): SqBrExprNode => ({
  type: 'SQUARE_BRACKET_EXPR',
  expr: [n],
})

export const PAR1 = (n: OperandNode): ParenExprNode => ({
  type: 'PAREN_EXPR',
  expr: [n],
})
