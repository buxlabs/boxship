const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")
const { CONFIG_FILENAME } = require("./boxship")

const BIN = path.join(__dirname, "..", "bin", "boxship.js")

const DEFAULT_EXCLUDE_FLAGS = `--exclude='.git' --exclude='.env' --exclude='.vscode' --exclude='.idea' --exclude='.DS_Store' --exclude='node_modules' --exclude='test' --exclude='coverage' --exclude='boxship.config.json'`

function run(args, config) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "boxship-cli-"))
  if (config !== undefined) {
    const content = typeof config === "string" ? config : JSON.stringify(config)
    fs.writeFileSync(path.join(cwd, CONFIG_FILENAME), content)
  }
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" })
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
    `ssh -l user s1.mydevil.net 'test -f ~/domains/example.com/public_nodejs/.env' || (scp .env.example user@s1.mydevil.net:~/domains/example.com/public_nodejs/.env && ([ -t 0 ] && ssh -t -l user s1.mydevil.net 'cd ~/domains/example.com/public_nodejs && \${EDITOR:-nano} .env' || (echo "seeded ~/domains/example.com/public_nodejs/.env from .env.example - fill in real values on the server and redeploy" >&2; exit 1)))`,
    `rsync -avz --delete -e ssh ${DEFAULT_EXCLUDE_FLAGS} --exclude='uploads' ./ user@s1.mydevil.net:~/domains/example.com/public_nodejs`,
    `ssh -l user s1.mydevil.net 'cd ~/domains/example.com/public_nodejs && npm install --production --omit=dev --silent --no-optional'`,
    `ssh -l user s1.mydevil.net 'devil www restart example.com'`,
  ])
})

test("it prints each command once in verbose dry-run mode", () => {
  const result = run(["staging", "--dry-run", "--verbose"], config)
  assert.strictEqual(result.status, 0)
  assert.deepStrictEqual(result.stdout.trim().split("\n"), [
    `ssh -l user -p 2222 staging.example.com 'mkdir -p ~/public'`,
    `rsync -avz --delete -e 'ssh -p 2222' ${DEFAULT_EXCLUDE_FLAGS} ./ user@staging.example.com:~/public`,
  ])
})

test("it deploys the only target when no name is given", () => {
  const result = run(["--dry-run"], {
    targets: { production: config.targets.staging },
  })
  assert.strictEqual(result.status, 0)
  assert.match(result.stdout, /rsync -avz --delete -e 'ssh -p 2222'/)
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

test("it fails on an unknown flag", () => {
  const result = run(["--nope"], config)
  assert.strictEqual(result.status, 1)
  assert.match(result.stderr, /usage: boxship/)
})
