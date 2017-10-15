import test from 'ava'
import deploy from './deploy'
import Strategy from './Strategy'

test('it deploys using given strategy', t => {
  let copied = false
  class Subject extends Strategy {
    copy() { copied = true }
  }
  deploy({}, Subject)
  t.truthy(copied)
})
