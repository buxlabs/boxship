const test = require('ava')
const strategies = require('.')

test('it exposes strategies', t => {
  t.truthy(strategies.MyDevilNet)
})
