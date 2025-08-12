import type { RegIndex } from '../instructions'

export const GENERIC_REGISTERS_COUNT = 8

export const REGISTER_NAMES = [
  'ip',
  'acc',
  'r1',
  'r2',
  'r3',
  'r4',
  'r5',
  'r6',
  'r7',
  'r8',
] as const

export type RegName = (typeof REGISTER_NAMES)[number]

export function regIndex(name: RegName): RegIndex {
  return REGISTER_NAMES.indexOf(name) as RegIndex
}
