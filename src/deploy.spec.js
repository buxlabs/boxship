const test = require("node:test")
const assert = require("node:assert")
const deploy = require("./deploy")

const target = {
  strategy: "Static",
  username: "user",
  host: "example.com",
  location: "~/public",
}

test("it prints commands without executing in dry-run mode", (t) => {
  const log = t.mock.method(console, "log", () => {})
  deploy(target, { dryRun: true })
  const lines = log.mock.calls.map((call) => call.arguments[0])
  assert.deepStrictEqual(lines, [
    `ssh -l user example.com 'rm -rf ~/public/*'`,
    `ssh -l user example.com 'mkdir -p ~/public'`,
    `rsync -avz -e ssh * user@example.com:~/public`,
  ])
})

test("it logs stages in verbose dry-run mode", (t) => {
  const log = t.mock.method(console, "log", () => {})
  deploy(target, { dryRun: true, verbose: true })
  const lines = log.mock.calls.map((call) => call.arguments[0])
  assert.deepStrictEqual(lines, [
    "deploy:start",
    "stage:clean",
    `ssh -l user example.com 'rm -rf ~/public/*'`,
    "stage:copy",
    `ssh -l user example.com 'mkdir -p ~/public'`,
    `rsync -avz -e ssh * user@example.com:~/public`,
    "deploy:stop",
  ])
})
