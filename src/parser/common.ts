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
  asRegisterPtr,
} from './types'
import { squareBracketExpr } from './group'
import type { OpcodeKeyword } from '../instructions'

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

export const keyword = (k: OpcodeKeyword) =>
  P.sequenceOf([upperOrLowerStr(k), P.whitespace])

export const separator = P.between(
  P.optionalWhitespace,
  P.optionalWhitespace
)(P.char(','))

export const register = P.choice(REGISTER_NAMES.map(upperOrLowerStr)).map(
  (value) => asRegister(value as RegName)
)

export const registerPtr = P.char('&')
  .chain(() => P.choice(REGISTER_NAMES.map(upperOrLowerStr)))
  .map((value) => asRegisterPtr(value as RegName))

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
