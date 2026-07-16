const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")
const { CONFIG_FILENAME } = require("./boxship")

const BIN = path.join(__dirname, "..", "bin", "boxship.js")

const DEFAULT_EXCLUDE_FLAGS = `--exclude='.git' --exclude='.env' --exclude='.vscode' --exclude='.idea' --exclude='.DS_Store' --exclude='.claude' --exclude='node_modules' --exclude='test' --exclude='temp' --exclude='tmp' --exclude='coverage' --exclude='boxship.config.json' --exclude='.rsync-partial'`

function run(args, config, env) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "boxship-cli-"))
  if (config !== undefined) {
    const content = typeof config === "string" ? config : JSON.stringify(config)
    fs.writeFileSync(path.join(cwd, CONFIG_FILENAME), content)
  }
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8", env })
}

function stubRemoteCommands() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boxship-stub-"))
  for (const name of ["ssh", "rsync"]) {
    const file = path.join(dir, name)
    fs.writeFileSync(file, `#!/bin/sh\necho "${name} $@"\n`)
    fs.chmodSync(file, 0o755)
  }
  return { ...process.env, PATH: `${dir}:${process.env.PATH}` }
}

const config = {
  targets: {
    production: {
      strategy: "MyDevilNet",
      username: "user",
      host: "s1.mydevil.net",
      domain: "example.com",
      location: "~/domains/example.com/public_nodejs",
      exclude: ["uploads"],
    },
    staging: {
      strategy: "Static",
      username: "user",
      host: "staging.example.com",
      location: "~/public",
      port: 2222,
    },
  },
}

test("it shows usage with --help", () => {
  const result = run(["--help"])
  assert.strictEqual(result.status, 0)
  assert.match(result.stdout, /usage: boxship \[target\] \[options\]/)
  assert.match(result.stdout, /--dry-run/)
})

test("it creates a starter config with init", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "boxship-cli-"))
  const result = spawnSync(process.execPath, [BIN, "init"], { cwd, encoding: "utf8" })
  assert.strictEqual(result.status, 0)
  assert.match(result.stdout, /created boxship\.config\.json/)
  const created = JSON.parse(fs.readFileSync(path.join(cwd, CONFIG_FILENAME), "utf8"))
  assert.ok(created.targets.production)
})

test("it fails when init would overwrite an existing config", () => {
  const result = run(["init"], config)
  assert.strictEqual(result.status, 1)
  assert.match(result.stderr, /boxship\.config\.json already exists/)
})

test("it fails with a preflight error when ssh and rsync are unavailable", () => {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "boxship-empty-"))
  const result = run(["staging"], config, { ...process.env, PATH: emptyDir })
  assert.strictEqual(result.status, 1)
  assert.match(result.stderr, /missing required commands: ssh, rsync/)
})

test("it fails when the config file is missing", () => {
  const result = run(["--dry-run"])
  assert.strictEqual(result.status, 1)
  assert.match(result.stderr, /missing config file: boxship\.config\.json/)
})

test("it fails when the config file is not valid json", () => {
  const result = run(["--dry-run"], "{ not json")
  assert.strictEqual(result.status, 1)
  assert.match(result.stderr, /invalid json in boxship\.config\.json/)
})

test("it prints the deployment commands in dry-run mode", () => {
  const result = run(["production", "--dry-run"], config)
  assert.strictEqual(result.status, 0)
  assert.deepStrictEqual(result.stdout.trim().split("\n"), [
    `ssh -l user s1.mydevil.net 'mkdir -p ~/domains/example.com/public_nodejs'`,
    `# ensure ~/domains/example.com/public_nodejs/.env is complete`,
    `rsync -avz --partial-dir=.rsync-partial --delete -e ssh ${DEFAULT_EXCLUDE_FLAGS} --exclude='uploads' ./ user@s1.mydevil.net:~/domains/example.com/public_nodejs`,
    `ssh -l user s1.mydevil.net 'cd ~/domains/example.com/public_nodejs && npm install --production --omit=dev --silent --no-optional'`,
    `ssh -l user s1.mydevil.net 'devil www restart example.com'`,
  ])
})

test("it prints each command once in verbose dry-run mode", () => {
  const result = run(["staging", "--dry-run", "--verbose"], config)
  assert.strictEqual(result.status, 0)
  assert.deepStrictEqual(result.stdout.trim().split("\n"), [
    `ssh -l user -p 2222 staging.example.com 'mkdir -p ~/public'`,
    `rsync -avz --partial-dir=.rsync-partial --delete -e 'ssh -p 2222' ${DEFAULT_EXCLUDE_FLAGS} ./ user@staging.example.com:~/public`,
  ])
})

test("it loads the config from a custom --config path", () => {
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "boxship-config-"))
  fs.writeFileSync(
    path.join(configDir, CONFIG_FILENAME),
    JSON.stringify({ targets: { staging: config.targets.staging } })
  )
  const result = run(["--dry-run", "--config", path.join(configDir, CONFIG_FILENAME)])
  assert.strictEqual(result.status, 0)
  assert.match(result.stdout, /rsync -avz --partial-dir=.rsync-partial --delete -e 'ssh -p 2222'/)
})

test("it fails with the custom path when the --config file is missing", () => {
  const result = run(["--dry-run", "--config", "../shared/boxship.config.json"])
  assert.strictEqual(result.status, 1)
  assert.match(result.stderr, /missing config file: \.\.\/shared\/boxship\.config\.json/)
})

test("it deploys the only target when no name is given", () => {
  const result = run(["--dry-run"], {
    targets: { production: config.targets.staging },
  })
  assert.strictEqual(result.status, 0)
  assert.match(result.stdout, /rsync -avz --partial-dir=.rsync-partial --delete -e 'ssh -p 2222'/)
})

test("it fails when no name is given and multiple targets exist", () => {
  const result = run(["--dry-run"], config)
  assert.strictEqual(result.status, 1)
  assert.match(result.stderr, /pick one of: production, staging/)
})

test("it fails on an unknown target", () => {
  const result = run(["prod", "--dry-run"], config)
  assert.strictEqual(result.status, 1)
  assert.match(result.stderr, /unknown target "prod", available: production, staging/)
})

test("it fails on an invalid target with validation errors", () => {
  const result = run(["--dry-run"], {
    targets: { web: { strategy: "static", host: "example.com" } },
  })
  assert.strictEqual(result.status, 1)
  assert.match(result.stderr, /invalid target "web":/)
  assert.match(result.stderr, /unknown strategy "static", available: Static, MyDevilNet/)
  assert.match(result.stderr, /"username" is required/)
  assert.match(result.stderr, /"location" is required/)
})

test("it shows the transfer preview with --diff without deploying", () => {
  const result = run(["staging", "--diff"], config, stubRemoteCommands())
  assert.strictEqual(result.status, 0)
  assert.match(result.stdout, /rsync -avzn/)
  assert.doesNotMatch(result.stdout, /deployed/)
})

test("it deploys and prints a summary with the elapsed time", () => {
  const result = run(["staging"], config, stubRemoteCommands())
  assert.strictEqual(result.status, 0)
  assert.match(result.stdout, /^deployed staging in \d+\.\ds$/m)
})

test("it fails on an unknown flag", () => {
  const result = run(["--nope"], config)
  assert.strictEqual(result.status, 1)
  assert.match(result.stderr, /usage: boxship/)
})
