import instructions from './instructions'
import { deepLog } from './util/deep-log'

const res = instructions.run('hltx')
if (res.isError) throw new Error(res.error)
deepLog(res.result, {
  maxDepth: Infinity,
})
