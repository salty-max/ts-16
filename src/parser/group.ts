import * as P from 'parsil'
import {
  asBinaryOp,
  asSquareBracketExpr,
  isOperator,
  typeParenExpr,
  type ExprToken,
  type GroupNode,
  type Nested,
  type OperandNode,
  type OperatorNode,
  type ParenExprNode,
} from './types'
import { hexLiteral, operator, variable } from './common'
import { last } from './util'

const PRIORITIES: Record<OperatorNode['type'], number> = {
  FACTOR: 2,
  PLUS: 1,
  MINUS: 0,
}

const at = <T>(arr: T[], idx: number, msg: string): T => {
  const v = arr[idx]
  if (v === undefined) throw new Error(msg)
  return v
}

function readValue(tok: ExprToken): OperandNode {
  if (isOperator(tok)) throw new Error('Expected value, got operator')
  if (tok.type === 'PAREN_EXPR' || tok.type === 'SQUARE_BRACKET_EXPR') {
    const { node, next } = parseExpr(tok.expr, 0, 0)
    if (next !== tok.expr.length) throw new Error('Trailing tokens in group')
    return node
  }
  return tok
}

function parseExpr(
  tokens: ExprToken[],
  i = 0,
  minPrec = 0
): { node: OperandNode; next: number } {
  if (tokens.length === 0) throw new Error('Empty expression')

  let idx = i

  // LHS
  const first = at(tokens, idx++, 'Expected value at start of expression')
  let lhs = readValue(first)

  // (op rhs)*
  while (idx < tokens.length) {
    const tok = tokens[idx]!
    if (!isOperator(tok)) break

    const prec = PRIORITIES[tok.type]
    if (prec < minPrec) break

    const op = tok
    idx++

    const rhsTok = at(tokens, idx++, 'Expected right-hand value after operator')
    let rhs = readValue(rhsTok)

    while (idx < tokens.length) {
      const look = tokens[idx]!
      if (!isOperator(look)) break
      const lookPrec = PRIORITIES[look.type]
      if (lookPrec <= prec) break
      const sub = parseExpr(tokens, idx, lookPrec)
      rhs = sub.node
      idx = sub.next
    }

    lhs = asBinaryOp(lhs, rhs, op)
  }

  return { node: lhs, next: idx }
}

function foldGroup<G extends GroupNode>(group: G): G {
  if (group.expr.length === 0) throw new Error('Empty group')
  if (group.expr.length === 1 && !isOperator(group.expr[0]!)) return group

  const { node, next } = parseExpr(group.expr, 0, 0)
  if (next !== group.expr.length) {
    throw new Error('Unexpected trailing tokens in expression')
  }

  return { ...group, expr: [node] } as G
}

export const squareBracketExpr = P.coroutine((run) => {
  run(P.char('['))
  run(P.optionalWhitespace)

  enum States {
    EXPECT_ELEMENT,
    EXPECT_OP,
  }

  const expr: ExprToken[] = []
  let state = States.EXPECT_ELEMENT

  while (true) {
    if (state === States.EXPECT_ELEMENT) {
      const res = run(P.choice([hexLiteral, variable, parenExpr]))
      expr.push(res)
      state = States.EXPECT_OP
      run(P.optionalWhitespace)
    } else if (state === States.EXPECT_OP) {
      const nextChar = run(P.peek)
      if (String.fromCharCode(nextChar) === ']') {
        run(P.char(']'))
        run(P.optionalWhitespace)
        break
      }

      const res = run(operator)
      expr.push(res)
      state = States.EXPECT_ELEMENT
      run(P.optionalWhitespace)
    }
  }

  return asSquareBracketExpr(expr)
}).map(foldGroup)

const parenExpr: P.Parser<ParenExprNode> = P.coroutine<ParenExprNode>((run) => {
  enum States {
    OPEN_BRACKET,
    OP_OR_CLOSE,
    ELEMENT_OR_OPEN,
    CLOSE_BRACKET,
  }

  const expr: Nested<ExprToken> = []
  const stack: Nested<ExprToken>[] = [expr]
  const open = P.char('(')
  const close = P.char(')')
  let state = States.ELEMENT_OR_OPEN

  run(open)

  while (true) {
    const curr = last(stack)
    const nextChar = String.fromCharCode(run(P.peek))

    switch (state) {
      case States.OPEN_BRACKET: {
        run(open)
        const child: Nested<ExprToken> = []
        curr.push(child)
        stack.push(child)
        run(P.optionalWhitespace)
        state = States.ELEMENT_OR_OPEN
        break
      }
      case States.CLOSE_BRACKET: {
        run(close)
        stack.pop()
        if (stack.length === 0) {
          break
        }
        run(P.optionalWhitespace)
        state = States.OP_OR_CLOSE
        break
      }
      case States.ELEMENT_OR_OPEN: {
        if (nextChar === ')') {
          run(P.fail('Unexpected end of expression'))
        }
        if (nextChar === '(') {
          state = States.OPEN_BRACKET
        } else {
          curr.push(run(P.choice([hexLiteral, variable])))
          run(P.optionalWhitespace)
          state = States.OP_OR_CLOSE
        }
        break
      }
      case States.OP_OR_CLOSE: {
        if (nextChar === ')') {
          state = States.CLOSE_BRACKET
        } else {
          curr.push(run(operator))
          run(P.optionalWhitespace)
          state = States.ELEMENT_OR_OPEN
        }
        break
      }
    }

    if (stack.length === 0) break
  }

  return typeParenExpr(expr)
})
