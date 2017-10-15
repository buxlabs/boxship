import test from 'ava'
import sinon from 'sinon'
import MyDevilNetStrategy from './MyDevilNet'

test('it cleans files via a ssh exec command', t => {
  let spy = sinon.spy()
  let subject = new MyDevilNetStrategy({
    username: 'user',
    host: 's1.mydevil.net',
    domain: 'buxlabs.pl',
    location: '~/domains/buxlabs.pl/public_nodejs',
    exec: spy
  })
  subject.clean()
  t.truthy(spy.calledWith(`ssh -l user s1.mydevil.net 'rm -rf ~/domains/buxlabs.pl/public_nodejs/public/*'`))
})

test('it copies files via a scp exec command', t => {
  let spy = sinon.spy()
  let subject = new MyDevilNetStrategy({
    username: 'user',
    host: 's1.mydevil.net',
    domain: 'buxlabs.pl',
    location: '~/domains/buxlabs.pl/public_nodejs',
    exec: spy
  })
  subject.copy()
  t.truthy(spy.calledWith(`scp -r build/* user@s1.mydevil.net:~/domains/buxlabs.pl/public_nodejs/public`))
})

test('it restarts server via a ssh exec command', t => {
  let spy = sinon.spy()
  let subject = new MyDevilNetStrategy({
    username: 'user',
    host: 's1.mydevil.net',
    domain: 'buxlabs.pl',
    location: '~/domains/buxlabs.pl/public_nodejs',
    exec: spy
  })
  subject.restart()
  t.truthy(spy.calledWith(`ssh -l user s1.mydevil.net 'devil www restart buxlabs.pl'`))
})
