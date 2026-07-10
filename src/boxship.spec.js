const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { CONFIG_FILENAME, strategies, load } = require("./boxship")

test("Static returns clean, mkdir and rsync commands", () => {
  const commands = strategies.Static({
    username: "user",
    host: "example.com",
    location: "~/public",
  })
  assert.deepStrictEqual(commands, [
    `ssh -l user example.com 'rm -rf ~/public/*'`,
    `ssh -l user example.com 'mkdir -p ~/public'`,
    `rsync -avz -e ssh * user@example.com:~/public`,
  ])
})

test("Static uses a custom port when given", () => {
  const commands = strategies.Static({
    username: "user",
    host: "example.com",
    location: "~/public",
    port: 2222,
  })
  assert.deepStrictEqual(commands, [
    `ssh -l user -p 2222 example.com 'rm -rf ~/public/*'`,
    `ssh -l user -p 2222 example.com 'mkdir -p ~/public'`,
    `rsync -avz -e 'ssh -p 2222' * user@example.com:~/public`,
  ])
})

test("Static uses a custom source when given", () => {
  const commands = strategies.Static({
    username: "user",
    host: "example.com",
    location: "~/public",
    source: "dist/*",
  })
  assert.strictEqual(commands[2], `rsync -avz -e ssh dist/* user@example.com:~/public`)
})

test("Static excludes a single dir when copying", () => {
  const commands = strategies.Static({
    username: "user",
    host: "example.com",
    location: "~/public",
    exclude: "node_modules",
  })
  assert.strictEqual(
    commands[2],
    `rsync -avz -e ssh --exclude='node_modules' * user@example.com:~/public`
  )
})

test("Static excludes multiple dirs given as a string", () => {
  const commands = strategies.Static({
    username: "user",
    host: "example.com",
    location: "~/public",
    exclude: "node_modules,test",
  })
  assert.strictEqual(
    commands[2],
    `rsync -avz -e ssh --exclude='node_modules' --exclude='test' * user@example.com:~/public`
  )
})

test("Static excludes multiple dirs given as an array", () => {
  const commands = strategies.Static({
    username: "user",
    host: "example.com",
    location: "~/public",
    exclude: ["node_modules", "test"],
  })
  assert.strictEqual(
    commands[2],
    `rsync -avz -e ssh --exclude='node_modules' --exclude='test' * user@example.com:~/public`
  )
})

test("MyDevilNet returns clean, mkdir, rsync, install and restart commands", () => {
  const commands = strategies.MyDevilNet({
    username: "user",
    host: "s1.mydevil.net",
    domain: "buxlabs.pl",
    location: "~/domains/buxlabs.pl/public_nodejs",
  })
  assert.deepStrictEqual(commands, [
    `ssh -l user s1.mydevil.net 'rm -rf ~/domains/buxlabs.pl/public_nodejs/*'`,
    `ssh -l user s1.mydevil.net 'mkdir -p ~/domains/buxlabs.pl/public_nodejs'`,
    `rsync -avz -e ssh * user@s1.mydevil.net:~/domains/buxlabs.pl/public_nodejs`,
    `ssh -l user s1.mydevil.net 'cd ~/domains/buxlabs.pl/public_nodejs && npm install --production --omit=dev --silent --no-optional'`,
    `ssh -l user s1.mydevil.net 'devil www restart buxlabs.pl'`,
  ])
})

test("MyDevilNet uses a custom npm binary when given", () => {
  const commands = strategies.MyDevilNet({
    username: "user",
    host: "s1.mydevil.net",
    domain: "buxlabs.pl",
    location: "~/domains/buxlabs.pl/public_nodejs",
    npm: "npm22",
  })
  assert.match(commands[3], /npm22 install/)
})

function createConfigDir(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boxship-"))
  if (content !== undefined) {
    const text = typeof content === "string" ? content : JSON.stringify(content)
    fs.writeFileSync(path.join(dir, CONFIG_FILENAME), text)
  }
  return dir
}

const target = {
  strategy: "Static",
  username: "user",
  host: "example.com",
  location: "~/public",
}

test("load returns the target by name", () => {
  const dir = createConfigDir({ targets: { production: target, staging: target } })
  assert.deepStrictEqual(load(dir, "staging"), target)
})

test("load returns the only target when no name is given", () => {
  const dir = createConfigDir({ targets: { production: target } })
  assert.deepStrictEqual(load(dir), target)
})

test("load throws when the config file is missing", () => {
  const dir = createConfigDir()
  assert.throws(() => load(dir), /missing config file/)
})

test("load throws when the config file is not valid json", () => {
  const dir = createConfigDir("{ not json")
  assert.throws(() => load(dir), /invalid json/)
})

test("load throws when the config has no targets", () => {
  const dir = createConfigDir({ targets: {} })
  assert.throws(() => load(dir), /at least one target/)
})

test("load throws when no name is given and multiple targets exist", () => {
  const dir = createConfigDir({ targets: { production: target, staging: target } })
  assert.throws(() => load(dir), /pick one of: production, staging/)
})

test("load throws when the target is unknown", () => {
  const dir = createConfigDir({ targets: { production: target } })
  assert.throws(() => load(dir, "prod"), /unknown target "prod", available: production/)
})

test("load throws when required fields are missing", () => {
  const dir = createConfigDir({ targets: { web: { strategy: "Static" } } })
  assert.throws(
    () => load(dir),
    /invalid target "web":\n {2}- "username" is required\n {2}- "host" is required\n {2}- "location" is required/
  )
})

test("load throws on an unknown strategy", () => {
  const dir = createConfigDir({ targets: { web: { ...target, strategy: "static" } } })
  assert.throws(() => load(dir), /unknown strategy "static", available: Static, MyDevilNet/)
})

test("load throws when domain is missing for MyDevilNet", () => {
  const dir = createConfigDir({ targets: { web: { ...target, strategy: "MyDevilNet" } } })
  assert.throws(() => load(dir), /"domain" is required/)
})
