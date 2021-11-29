const test = require('ava')
const Strategy = require('./Strategy')

test('it deploys', t => {
  let cleaned = false
  let copied = false
  let restarted = false
  class Subject extends Strategy {
    clean() { cleaned = true }
    copy() { copied = true }
    restart() { restarted = true }
  }
  let subject = new Subject({})
  subject.deploy()
  t.truthy(cleaned)
  t.truthy(copied)
  t.truthy(restarted)
})
