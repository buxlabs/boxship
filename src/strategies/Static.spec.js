const test = require("node:test")
const assert = require("node:assert")
const StaticStrategy = require("./Static")

function createSubject(overrides = {}) {
  const commands = []
  const subject = new StaticStrategy({
    username: "user",
    host: "example.com",
    location: "~/public",
    exec: (command) => commands.push(command),
    ...overrides,
  })
  return { subject, commands }
}

test("it cleans files via a ssh exec command", () => {
  const { subject, commands } = createSubject()
  subject.clean()
  assert.deepStrictEqual(commands, [`ssh -l user example.com 'rm -rf ~/public/*'`])
})

test("it copies files via a rsync exec command", () => {
  const { subject, commands } = createSubject()
  subject.copy()
  assert.deepStrictEqual(commands, [
    `ssh -l user example.com 'mkdir -p ~/public'`,
    `rsync -avz -e ssh * user@example.com:~/public`,
  ])
})

test("it can exclude a single dir when copying", () => {
  const { subject, commands } = createSubject({ exclude: "node_modules" })
  subject.copy()
  assert.deepStrictEqual(commands[1],
    `rsync -avz -e ssh --exclude='node_modules' * user@example.com:~/public`
  )
})

test("it can exclude multiple dirs when copying", () => {
  const { subject, commands } = createSubject({ exclude: "node_modules,test" })
  subject.copy()
  assert.deepStrictEqual(commands[1],
    `rsync -avz -e ssh --exclude='node_modules' --exclude='test' * user@example.com:~/public`
  )
})

test("it uses a custom port when given", () => {
  const { subject, commands } = createSubject({ port: 2222 })
  subject.deploy()
  assert.deepStrictEqual(commands, [
    `ssh -l user -p 2222 example.com 'rm -rf ~/public/*'`,
    `ssh -l user -p 2222 example.com 'mkdir -p ~/public'`,
    `rsync -avz -e 'ssh -p 2222' * user@example.com:~/public`,
  ])
})

test("it runs clean and copy stages in order on deploy", () => {
  const { subject, commands } = createSubject()
  subject.deploy()
  assert.deepStrictEqual(commands, [
    `ssh -l user example.com 'rm -rf ~/public/*'`,
    `ssh -l user example.com 'mkdir -p ~/public'`,
    `rsync -avz -e ssh * user@example.com:~/public`,
  ])
})
