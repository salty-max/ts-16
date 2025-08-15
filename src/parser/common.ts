import * as P from 'parsil'
import { REGISTER_NAMES, type RegName } from '../util'
import {
  asHexLiteral,
  asOpFactor,
  asOpMinus,
  asOpPlus,
  asRegister,
  asVariable,
  asAddrExprNode,
  asAddrLiteral,
} from './types'
import { squareBracketExpr } from './group'

export const upperOrLowerStr = (s: string) =>
  P.choice([P.str(s.toUpperCase()), P.str(s.toLowerCase())])

export const mapJoin = (parser: P.Parser<string[]>) =>
  parser.map((items) => items.join(''))

export const validIdentifier = mapJoin(
  P.sequenceOf([
    P.regex(/^[a-zA-Z_]/),
    P.possibly(P.regex(/^[a-zA-Z0-9_]+/)).map((x) => (x === null ? '' : x)),
  ])
)

export const register = P.choice(
  REGISTER_NAMES.map((n) => upperOrLowerStr(n))
).map((value) => asRegister(value as RegName))

const hexDigit = P.regex(/^[0-9A-Fa-f]/)
export const hexLiteral = P.char('$')
  .chain(() => mapJoin(P.manyOne(hexDigit)))
  .map(asHexLiteral)

const addrLiteral = P.char('&')
  .chain(() => mapJoin(P.manyOne(hexDigit)))
  .map(asAddrLiteral)

export const variable = P.char('!')
  .chain(() => validIdentifier)
  .map(asVariable)

export const operator = P.choice([
  P.char('+').map((value) => asOpPlus(value as '+')),
  P.char('-').map((value) => asOpMinus(value as '-')),
  P.char('*').map((value) => asOpFactor(value as '*')),
])

export const addrExpr = P.choice([
  addrLiteral,
  P.char('&').chain(() => squareBracketExpr),
]).map(asAddrExprNode)
