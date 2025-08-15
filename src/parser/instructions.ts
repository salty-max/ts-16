import * as P from 'parsil'
import { addrExpr, hexLiteral, register, upperOrLowerStr } from './common'
import { asInstruction } from './types'
import { squareBracketExpr } from './group'

export const movLitToReg = P.coroutine((run) => {
  run(upperOrLowerStr('mov'))
  run(P.whitespace)

  const arg1 = run(P.choice([hexLiteral, squareBracketExpr]))

  run(P.optionalWhitespace)
  run(P.char(','))
  run(P.optionalWhitespace)

  const arg2 = run(register)
  run(P.optionalWhitespace)

  return asInstruction({
    opcode: 'MOV_LIT_REG',
    args: [arg1, arg2],
  })
})

export const movMemToReg = P.coroutine((run) => {
  run(upperOrLowerStr('mov'))
  run(P.whitespace)

  const arg1 = run(addrExpr)

  run(P.optionalWhitespace)
  run(P.char(','))
  run(P.optionalWhitespace)

  const arg2 = run(register)
  run(P.optionalWhitespace)

  return asInstruction({
    opcode: 'MOV_MEM_REG',
    args: [arg1, arg2],
  })
})
