const test = require("node:test")
const assert = require("node:assert")
const MyDevilNetStrategy = require("./MyDevilNet")

function createSubject(overrides = {}) {
  const commands = []
  const subject = new MyDevilNetStrategy({
    username: "user",
    host: "s1.mydevil.net",
    domain: "buxlabs.pl",
    location: "~/domains/buxlabs.pl/public_nodejs",
    exec: (command) => commands.push(command),
    ...overrides,
  })
  return { subject, commands }
}

test("it cleans files via a ssh exec command", () => {
  const { subject, commands } = createSubject()
  subject.clean()
  assert.deepStrictEqual(commands, [
    `ssh -l user s1.mydevil.net 'rm -rf ~/domains/buxlabs.pl/public_nodejs/*'`,
  ])
})

test("it copies files via a rsync exec command", () => {
  const { subject, commands } = createSubject()
  subject.copy()
  assert.deepStrictEqual(commands, [
    `ssh -l user s1.mydevil.net 'mkdir -p ~/domains/buxlabs.pl/public_nodejs'`,
    `rsync -avz -e ssh * user@s1.mydevil.net:~/domains/buxlabs.pl/public_nodejs`,
  ])
})

test("it can exclude a single dir when copying", () => {
  const { subject, commands } = createSubject({ exclude: "node_modules" })
  subject.copy()
  assert.deepStrictEqual(commands[1],
    `rsync -avz -e ssh --exclude='node_modules' * user@s1.mydevil.net:~/domains/buxlabs.pl/public_nodejs`
  )
})

test("it can exclude multiple dirs when copying", () => {
  const { subject, commands } = createSubject({ exclude: "node_modules,test" })
  subject.copy()
  assert.deepStrictEqual(commands[1],
    `rsync -avz -e ssh --exclude='node_modules' --exclude='test' * user@s1.mydevil.net:~/domains/buxlabs.pl/public_nodejs`
  )
})

test("it can exclude dirs given as an array", () => {
  const { subject, commands } = createSubject({ exclude: ["node_modules", "test"] })
  subject.copy()
  assert.deepStrictEqual(commands[1],
    `rsync -avz -e ssh --exclude='node_modules' --exclude='test' * user@s1.mydevil.net:~/domains/buxlabs.pl/public_nodejs`
  )
})

test("it installs packages via npm", () => {
  const { subject, commands } = createSubject()
  subject.install()
  assert.deepStrictEqual(commands, [
    `ssh -l user s1.mydevil.net 'cd ~/domains/buxlabs.pl/public_nodejs && npm install --production --omit=dev --silent --no-optional'`,
  ])
})

test("it restarts server via a ssh exec command", () => {
  const { subject, commands } = createSubject()
  subject.restart()
  assert.deepStrictEqual(commands, [
    `ssh -l user s1.mydevil.net 'devil www restart buxlabs.pl'`,
  ])
})

test("it runs all stages in order on deploy", () => {
  const { subject, commands } = createSubject()
  subject.deploy()
  assert.deepStrictEqual(commands, [
    `ssh -l user s1.mydevil.net 'rm -rf ~/domains/buxlabs.pl/public_nodejs/*'`,
    `ssh -l user s1.mydevil.net 'mkdir -p ~/domains/buxlabs.pl/public_nodejs'`,
    `rsync -avz -e ssh * user@s1.mydevil.net:~/domains/buxlabs.pl/public_nodejs`,
    `ssh -l user s1.mydevil.net 'cd ~/domains/buxlabs.pl/public_nodejs && npm install --production --omit=dev --silent --no-optional'`,
    `ssh -l user s1.mydevil.net 'devil www restart buxlabs.pl'`,
  ])
})
