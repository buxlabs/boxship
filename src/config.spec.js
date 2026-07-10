const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { CONFIG_FILENAME, loadConfig, selectTarget, validateTarget } = require("./config")

function createConfigDir(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boxship-"))
  if (content !== undefined) {
    fs.writeFileSync(path.join(dir, CONFIG_FILENAME), content)
  }
  return dir
}

test("it loads a config file", () => {
  const dir = createConfigDir(
    JSON.stringify({ targets: { production: { strategy: "Static" } } })
  )
  const config = loadConfig(dir)
  assert.strictEqual(config.targets.production.strategy, "Static")
})

test("it throws when the config file is missing", () => {
  const dir = createConfigDir()
  assert.throws(() => loadConfig(dir), /missing config file/)
})

test("it throws when the config file is not valid json", () => {
  const dir = createConfigDir("{ not json")
  assert.throws(() => loadConfig(dir), /invalid json/)
})

test("it throws when the config has no targets", () => {
  const dir = createConfigDir(JSON.stringify({ targets: {} }))
  assert.throws(() => loadConfig(dir), /at least one target/)
})

test("it selects a target by name", () => {
  const config = { targets: { production: { host: "a" }, staging: { host: "b" } } }
  const { name, target } = selectTarget(config, "staging")
  assert.strictEqual(name, "staging")
  assert.strictEqual(target.host, "b")
})

test("it selects the only target when no name is given", () => {
  const config = { targets: { production: { host: "a" } } }
  const { name } = selectTarget(config)
  assert.strictEqual(name, "production")
})

test("it throws when no name is given and multiple targets exist", () => {
  const config = { targets: { production: {}, staging: {} } }
  assert.throws(() => selectTarget(config), /pick one of: production, staging/)
})

test("it throws when the target is unknown", () => {
  const config = { targets: { production: {} } }
  assert.throws(() => selectTarget(config, "prod"), /unknown target "prod"/)
})

test("it validates a correct target", () => {
  const errors = validateTarget({
    strategy: "MyDevilNet",
    username: "user",
    host: "s1.mydevil.net",
    domain: "example.com",
    location: "~/domains/example.com/public_nodejs",
  })
  assert.deepStrictEqual(errors, [])
})

test("it reports missing required fields", () => {
  const errors = validateTarget({ strategy: "Static" })
  assert.deepStrictEqual(errors, [
    `"username" is required`,
    `"host" is required`,
    `"location" is required`,
  ])
})

test("it reports an unknown strategy", () => {
  const errors = validateTarget({
    strategy: "static",
    username: "user",
    host: "example.com",
    location: "~/public",
  })
  assert.deepStrictEqual(errors, [
    `unknown strategy "static", available: Static, MyDevilNet`,
  ])
})

test("it requires a domain for the MyDevilNet strategy", () => {
  const errors = validateTarget({
    strategy: "MyDevilNet",
    username: "user",
    host: "s1.mydevil.net",
    location: "~/domains/example.com/public_nodejs",
  })
  assert.deepStrictEqual(errors, [`"domain" is required for the MyDevilNet strategy`])
})
