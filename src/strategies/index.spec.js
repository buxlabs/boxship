import test from 'ava'
import strategies from '.'

test('it exposes strategies', t => {
  t.truthy(strategies.MyDevilNet)
})
