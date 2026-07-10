const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const os = require("os")
const path = require("path")
const http = require("http")
const { CONFIG_FILENAME, strategies, load, run, diffCommand, verify } = require("./boxship")

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

test("MyDevilNet returns mkdir, env check, rsync, env keys check, install and restart commands", () => {
  const commands = strategies.MyDevilNet({
    username: "user",
    host: "s1.mydevil.net",
    domain: "buxlabs.pl",
    location: "~/domains/buxlabs.pl/public_nodejs",
  })
  assert.deepStrictEqual(commands, [
    `ssh -l user s1.mydevil.net 'mkdir -p ~/domains/buxlabs.pl/public_nodejs'`,
    {
      command: `ssh -l user s1.mydevil.net 'test -f ~/domains/buxlabs.pl/public_nodejs/.env' || (scp .env.example user@s1.mydevil.net:~/domains/buxlabs.pl/public_nodejs/.env && ([ -t 0 ] && ssh -t -l user s1.mydevil.net 'cd ~/domains/buxlabs.pl/public_nodejs && \${EDITOR:-nano} .env' || (echo "seeded ~/domains/buxlabs.pl/public_nodejs/.env from .env.example - fill in real values on the server and redeploy" >&2; exit 1)))`,
      interactive: true,
    },
    `rsync -avz --delete -e ssh ${DEFAULT_EXCLUDE_FLAGS} ./ user@s1.mydevil.net:~/domains/buxlabs.pl/public_nodejs`,
    {
      command: `ssh -l user s1.mydevil.net 'cd ~/domains/buxlabs.pl/public_nodejs && missing=$(for key in $(grep -E "^[A-Za-z_][A-Za-z0-9_]*=" .env.example 2>/dev/null | cut -d= -f1); do grep -q "^$key=" .env || echo $key; done); if [ -n "$missing" ]; then for key in $missing; do grep "^$key=" .env.example >> .env; done; echo "added missing keys to ~/domains/buxlabs.pl/public_nodejs/.env: $missing - fill in real values" >&2; exit 1; fi' || ([ -t 0 ] && ssh -t -l user s1.mydevil.net 'cd ~/domains/buxlabs.pl/public_nodejs && \${EDITOR:-nano} .env' || (echo "filled ~/domains/buxlabs.pl/public_nodejs/.env with missing keys from .env.example - fill in real values on the server and redeploy" >&2; exit 1))`,
      interactive: true,
    },
    `ssh -l user s1.mydevil.net 'cd ~/domains/buxlabs.pl/public_nodejs && npm install --production --omit=dev --silent --no-optional'`,
    `ssh -l user s1.mydevil.net 'devil www restart buxlabs.pl'`,
  ])
})

test("the env keys check appends missing keys and fails, then passes once complete", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boxship-drift-"))
  fs.writeFileSync(path.join(dir, ".env.example"), "# example\nKEY=value\nNEW_KEY=other\n")
  fs.writeFileSync(path.join(dir, ".env"), "KEY=real\n")
  const commands = strategies.MyDevilNet({
    username: "user",
    host: "example.com",
    domain: "example.com",
    location: dir,
  })
  const check = commands[3].command.replaceAll("ssh -l user example.com ", "sh -c ")
  assert.throws(() => run(check), /added missing keys to .*: NEW_KEY/)
  assert.strictEqual(
    fs.readFileSync(path.join(dir, ".env"), "utf8"),
    "KEY=real\nNEW_KEY=other\n"
  )
  assert.doesNotThrow(() => run(check))
})

test("the env keys check passes when there is no .env.example", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boxship-drift-"))
  fs.writeFileSync(path.join(dir, ".env"), "KEY=real\n")
  const commands = strategies.MyDevilNet({
    username: "user",
    host: "example.com",
    domain: "example.com",
    location: dir,
  })
  const check = commands[3].command.replaceAll("ssh -l user example.com ", "sh -c ")
  assert.doesNotThrow(() => run(check))
})

test("the env check seeds .env from .env.example and fails, then passes once .env exists", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boxship-env-"))
  fs.writeFileSync(path.join(dir, ".env.example"), "KEY=value\n")
  const commands = strategies.MyDevilNet({
    username: "user",
    host: "example.com",
    domain: "example.com",
    location: dir,
  })
  const check = commands[1].command
    .replaceAll("ssh -l user example.com ", "sh -c ")
    .replaceAll("scp .env.example user@example.com:", "cp .env.example ")
  const cwd = process.cwd()
  process.chdir(dir)
  t.after(() => process.chdir(cwd))
  assert.throws(() => run(check), /seeded .* from \.env\.example/)
  assert.strictEqual(fs.readFileSync(path.join(dir, ".env"), "utf8"), "KEY=value\n")
  assert.doesNotThrow(() => run(check))
})

test("MyDevilNet uses a custom npm binary when given", () => {
  const commands = strategies.MyDevilNet({
    username: "user",
    host: "s1.mydevil.net",
    domain: "buxlabs.pl",
    location: "~/domains/buxlabs.pl/public_nodejs",
    npm: "npm22",
  })
  assert.match(commands[4], /npm22 install/)
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
