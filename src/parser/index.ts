import { movMemToReg } from './instructions'
import { deepLog } from './util/deep-log'

const res = movMemToReg.run(
  'mov &[$42 + !loc - ($05 * ($31 * !var) - $07)], r4'
)
// const res = movMemToReg.run('mov &42, r7')
if (res.isError) throw new Error(res.error)
deepLog(res.result, {
  maxDepth: Infinity,
})
