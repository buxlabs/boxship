const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const os = require("os")
const path = require("path")
const http = require("http")
const { execSync } = require("child_process")
const {
  CONFIG_FILENAME,
  strategies,
  load,
  run,
  diffCommand,
  verify,
  ensureEnv,
  parseKeys,
  missingEnvLines,
} = require("./boxship")

const DEFAULT_EXCLUDE_FLAGS = `--exclude='.git' --exclude='.env' --exclude='.vscode' --exclude='.idea' --exclude='.DS_Store' --exclude='node_modules' --exclude='test' --exclude='coverage' --exclude='boxship.config.json'`

test("Static returns mkdir and rsync commands", () => {
  const commands = strategies.Static({
    username: "user",
    host: "example.com",
    location: "~/public",
  })
  assert.deepStrictEqual(commands, [
    `ssh -l user example.com 'mkdir -p ~/public'`,
    `rsync -avz --delete -e ssh ${DEFAULT_EXCLUDE_FLAGS} ./ user@example.com:~/public`,
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
    `ssh -l user -p 2222 example.com 'mkdir -p ~/public'`,
    `rsync -avz --delete -e 'ssh -p 2222' ${DEFAULT_EXCLUDE_FLAGS} ./ user@example.com:~/public`,
  ])
})

test("Static uses a custom source when given", () => {
  const commands = strategies.Static({
    username: "user",
    host: "example.com",
    location: "~/public",
    source: "dist/",
  })
  assert.strictEqual(
    commands[1],
    `rsync -avz --delete -e ssh ${DEFAULT_EXCLUDE_FLAGS} dist/ user@example.com:~/public`
  )
})

test("Static appends a custom exclude to the defaults", () => {
  const commands = strategies.Static({
    username: "user",
    host: "example.com",
    location: "~/public",
    exclude: "uploads",
  })
  assert.strictEqual(
    commands[1],
    `rsync -avz --delete -e ssh ${DEFAULT_EXCLUDE_FLAGS} --exclude='uploads' ./ user@example.com:~/public`
  )
})

test("Static appends multiple excludes given as a string", () => {
  const commands = strategies.Static({
    username: "user",
    host: "example.com",
    location: "~/public",
    exclude: "uploads,tmp",
  })
  assert.strictEqual(
    commands[1],
    `rsync -avz --delete -e ssh ${DEFAULT_EXCLUDE_FLAGS} --exclude='uploads' --exclude='tmp' ./ user@example.com:~/public`
  )
})

test("Static appends multiple excludes given as an array", () => {
  const commands = strategies.Static({
    username: "user",
    host: "example.com",
    location: "~/public",
    exclude: ["uploads", "tmp"],
  })
  assert.strictEqual(
    commands[1],
    `rsync -avz --delete -e ssh ${DEFAULT_EXCLUDE_FLAGS} --exclude='uploads' --exclude='tmp' ./ user@example.com:~/public`
  )
})

test("Static does not duplicate excludes already in the defaults", () => {
  const commands = strategies.Static({
    username: "user",
    host: "example.com",
    location: "~/public",
    exclude: ["node_modules", "uploads"],
  })
  assert.strictEqual(
    commands[1],
    `rsync -avz --delete -e ssh ${DEFAULT_EXCLUDE_FLAGS} --exclude='uploads' ./ user@example.com:~/public`
  )
})

test("MyDevilNet returns mkdir, env step, rsync, install and restart commands", () => {
  const commands = strategies.MyDevilNet({
    username: "user",
    host: "s1.mydevil.net",
    domain: "buxlabs.pl",
    location: "~/domains/buxlabs.pl/public_nodejs",
  })
  assert.deepStrictEqual(commands, [
    `ssh -l user s1.mydevil.net 'mkdir -p ~/domains/buxlabs.pl/public_nodejs'`,
    {
      description: `ensure ~/domains/buxlabs.pl/public_nodejs/.env is complete`,
      execute: ensureEnv,
    },
    `rsync -avz --delete -e ssh ${DEFAULT_EXCLUDE_FLAGS} ./ user@s1.mydevil.net:~/domains/buxlabs.pl/public_nodejs`,
    `ssh -l user s1.mydevil.net 'cd ~/domains/buxlabs.pl/public_nodejs && npm install --production --omit=dev --silent --no-optional'`,
    `ssh -l user s1.mydevil.net 'devil www restart buxlabs.pl'`,
  ])
})

test("parseKeys extracts key names from env file content", () => {
  const content = "# comment\n\nKEY=value\n  SPACED_KEY = value\nNO_VALUE=\nlower_key=x\n1BAD=x\nnot a key line\n"
  assert.deepStrictEqual(parseKeys(content), ["KEY", "SPACED_KEY", "NO_VALUE", "lower_key"])
})

test("parseKeys accepts bare key names as produced by cut", () => {
  assert.deepStrictEqual(parseKeys("# comment\nKEY\nOTHER_KEY\n"), ["KEY", "OTHER_KEY"])
})

test("parseKeys handles CRLF line endings and a byte order mark", () => {
  assert.deepStrictEqual(parseKeys("\uFEFFKEY=value\r\nOTHER=x\r\n"), ["KEY", "OTHER"])
})

test("missingEnvLines returns lines without CRLF line endings", () => {
  assert.deepStrictEqual(missingEnvLines("KEY=value\r\nNEW=x\r\n", ["KEY"]), ["NEW=x"])
})

test("missingEnvLines returns example lines whose keys are absent", () => {
  const example = "# comment\nKEY=value\nNEW_KEY=other\nEMPTY=\n"
  assert.deepStrictEqual(missingEnvLines(example, ["KEY"]), ["NEW_KEY=other", "EMPTY="])
})

test("missingEnvLines returns nothing when all keys are present", () => {
  assert.deepStrictEqual(missingEnvLines("KEY=value\n", ["KEY", "EXTRA"]), [])
})

test("missingEnvLines ignores comments and malformed lines", () => {
  assert.deepStrictEqual(missingEnvLines("# NOT_A_KEY=1\nnot a key\n1BAD=x\n", []), [])
})

function createEnvDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boxship-env-"))
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content)
  }
  return dir
}

function localExec(dir) {
  return (command, options) =>
    execSync(
      command
        .replaceAll("ssh -l user example.com ", "sh -c ")
        .replaceAll("scp .env.example user@example.com:", "cp .env.example "),
      { ...options, cwd: dir }
    )
}

function createEnvTarget(dir) {
  return { username: "user", host: "example.com", domain: "example.com", location: dir }
}

test("ensureEnv seeds .env from .env.example on a first deploy", (t) => {
  const dir = createEnvDir({ ".env.example": "KEY=value\n" })
  const cwd = process.cwd()
  process.chdir(dir)
  t.after(() => process.chdir(cwd))
  t.mock.method(console, "log", () => {})
  assert.throws(
    () => ensureEnv(createEnvTarget(dir), { exec: localExec(dir) }),
    /fill in real values in .* and redeploy/
  )
  assert.strictEqual(fs.readFileSync(path.join(dir, ".env"), "utf8"), "KEY=value\n")
})

test("ensureEnv appends missing keys to an existing .env", (t) => {
  const dir = createEnvDir({
    ".env.example": "# example\nKEY=value\nNEW_KEY=other\n",
    ".env": "KEY=real\n",
  })
  const cwd = process.cwd()
  process.chdir(dir)
  t.after(() => process.chdir(cwd))
  const log = t.mock.method(console, "log", () => {})
  assert.throws(
    () => ensureEnv(createEnvTarget(dir), { exec: localExec(dir) }),
    /fill in real values in .* and redeploy/
  )
  assert.strictEqual(
    fs.readFileSync(path.join(dir, ".env"), "utf8"),
    "KEY=real\n\nNEW_KEY=other\n"
  )
  assert.match(log.mock.calls[0].arguments[0], /added missing keys to .*: NEW_KEY/)
})

test("ensureEnv appends cleanly when .env has no trailing newline", (t) => {
  const dir = createEnvDir({
    ".env.example": "KEY=value\nNEW_KEY=other\n",
    ".env": "KEY=real",
  })
  const cwd = process.cwd()
  process.chdir(dir)
  t.after(() => process.chdir(cwd))
  t.mock.method(console, "log", () => {})
  assert.throws(
    () => ensureEnv(createEnvTarget(dir), { exec: localExec(dir) }),
    /fill in real values in .* and redeploy/
  )
  assert.strictEqual(
    fs.readFileSync(path.join(dir, ".env"), "utf8"),
    "KEY=real\nNEW_KEY=other\n"
  )
})

test("ensureEnv does nothing when the project has no .env.example", (t) => {
  const dir = createEnvDir({})
  const cwd = process.cwd()
  process.chdir(dir)
  t.after(() => process.chdir(cwd))
  assert.doesNotThrow(() => ensureEnv(createEnvTarget(dir), { exec: localExec(dir) }))
  assert.strictEqual(fs.existsSync(path.join(dir, ".env")), false)
})

test("ensureEnv passes silently when .env has all the keys", (t) => {
  const dir = createEnvDir({
    ".env.example": "KEY=value\nOTHER=x\n",
    ".env": "OTHER=real\nKEY=real\nEXTRA=server-only\n",
  })
  const cwd = process.cwd()
  process.chdir(dir)
  t.after(() => process.chdir(cwd))
  assert.doesNotThrow(() => ensureEnv(createEnvTarget(dir), { exec: localExec(dir) }))
})

test("ensureEnv passes silently when there is no local .env.example", (t) => {
  const dir = createEnvDir({ ".env": "KEY=real\n" })
  const cwd = process.cwd()
  process.chdir(dir)
  t.after(() => process.chdir(cwd))
  assert.doesNotThrow(() => ensureEnv(createEnvTarget(dir), { exec: localExec(dir) }))
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
  assert.deepStrictEqual(load(dir, "staging"), { name: "staging", target })
})

test("load returns the only target when no name is given", () => {
  const dir = createConfigDir({ targets: { production: target } })
  assert.deepStrictEqual(load(dir), { name: "production", target })
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

test("load rejects a target name from the prototype chain", () => {
  const dir = createConfigDir({ targets: { production: target } })
  assert.throws(() => load(dir, "__proto__"), /unknown target "__proto__"/)
})

test("load rejects a strategy name from the prototype chain", () => {
  const dir = createConfigDir({ targets: { web: { ...target, strategy: "constructor" } } })
  assert.throws(() => load(dir), /unknown strategy "constructor"/)
})

test("load throws on an unknown strategy", () => {
  const dir = createConfigDir({ targets: { web: { ...target, strategy: "static" } } })
  assert.throws(() => load(dir), /unknown strategy "static", available: Static, MyDevilNet/)
})

test("load throws when domain is missing for MyDevilNet", () => {
  const dir = createConfigDir({ targets: { web: { ...target, strategy: "MyDevilNet" } } })
  assert.throws(() => load(dir), /"domain" is required/)
})

test("load throws when a location contains whitespace", () => {
  const dir = createConfigDir({
    targets: { web: { ...target, location: "~/my public" } },
  })
  assert.throws(() => load(dir), /"location" contains unsupported characters/)
})

test("load throws when a username contains shell symbols", () => {
  const dir = createConfigDir({
    targets: { web: { ...target, username: "user;rm" } },
  })
  assert.throws(() => load(dir), /"username" contains unsupported characters/)
})

test("load throws when an exclude entry contains a quote", () => {
  const dir = createConfigDir({
    targets: { web: { ...target, exclude: ["uploads", "it's"] } },
  })
  assert.throws(() => load(dir), /exclude "it's" contains unsupported characters/)
})

test("load throws when the port is not an integer", () => {
  const dir = createConfigDir({
    targets: { web: { ...target, port: "2222" } },
  })
  assert.throws(() => load(dir), /"port" must be an integer/)
})

test("run executes a command without throwing on success", () => {
  assert.doesNotThrow(() => run(`node -e "process.exit(0)"`))
})

test("run includes the failing command and its stderr in the error", () => {
  assert.throws(
    () => run(`node -e "console.error('remote error'); process.exit(1)"`),
    (error) => {
      assert.match(error.message, /command failed: node -e/)
      assert.match(error.message, /remote error/)
      return true
    }
  )
})

test("run includes stdout of the failing command in the error", () => {
  assert.throws(
    () => run(`node -e "console.log('some output'); process.exit(1)"`),
    (error) => {
      assert.match(error.message, /some output/)
      return true
    }
  )
})

test("load accepts locations with tildes, dots and dashes", () => {
  const dir = createConfigDir({
    targets: {
      web: { ...target, location: "~/domains/my-site.example.com/public_html" },
    },
  })
  assert.deepStrictEqual(
    load(dir).target.location,
    "~/domains/my-site.example.com/public_html"
  )
})

test("load throws when the url is not http", () => {
  const dir = createConfigDir({ targets: { web: { ...target, url: "example.com" } } })
  assert.throws(() => load(dir), /"url" must start with http:\/\/ or https:\/\//)
})

test("diffCommand returns the rsync command in dry-run mode", () => {
  const command = diffCommand({
    username: "user",
    host: "example.com",
    location: "~/public",
  })
  assert.strictEqual(
    command,
    `rsync -avzn --delete -e ssh ${DEFAULT_EXCLUDE_FLAGS} ./ user@example.com:~/public`
  )
})

function createServer(statusCode) {
  const server = http.createServer((request, response) => {
    response.statusCode = statusCode
    response.end()
  })
  return new Promise((resolve) =>
    server.listen(0, () =>
      resolve({ server, url: `http://localhost:${server.address().port}/` })
    )
  )
}

test("verify passes when the url responds with 200", async (t) => {
  const { server, url } = await createServer(200)
  t.after(() => server.close())
  t.mock.method(console, "log", () => {})
  await assert.doesNotReject(() => verify({ url }))
})

test("verify fails when the url responds with an error status", async (t) => {
  const { server, url } = await createServer(500)
  t.after(() => server.close())
  await assert.rejects(
    () => verify({ url }, { attempts: 1 }),
    /verification failed: .* responded with 500/
  )
})

test("verify fails when the server is unreachable", async () => {
  await assert.rejects(
    () => verify({ url: "http://127.0.0.1:1/" }, { attempts: 1 }),
    /verification failed/
  )
})

test("verify retries while the server is restarting", async (t) => {
  let requests = 0
  const server = http.createServer((request, response) => {
    requests++
    response.statusCode = requests < 3 ? 503 : 200
    response.end()
  })
  await new Promise((resolve) => server.listen(0, resolve))
  const url = `http://localhost:${server.address().port}/`
  t.after(() => server.close())
  t.mock.method(console, "log", () => {})
  await assert.doesNotReject(() => verify({ url }, { attempts: 3, delay: 10 }))
  assert.strictEqual(requests, 3)
})

test("verify gives up after the configured attempts", async (t) => {
  const { server, url } = await createServer(503)
  t.after(() => server.close())
  await assert.rejects(
    () => verify({ url }, { attempts: 2, delay: 10 }),
    /responded with 503/
  )
})

test("verify does nothing when the target has no url", async () => {
  await assert.doesNotReject(() => verify({}))
})
