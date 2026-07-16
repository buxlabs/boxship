const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const CONFIG_FILENAME = "boxship.config.json"

const ENV_EXAMPLE = ".env.example"

const REQUIRED = {
  Static: ["username", "host", "location"],
  MyDevilNet: ["username", "host", "location", "domain"],
}

const UNSAFE_CHARACTERS = /[\s'"`$;&|<>()\\]/

const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/

const DEFAULT_EXCLUDES = [
  ".git",
  ".env",
  ".vscode",
  ".idea",
  ".DS_Store",
  ".claude",
  "node_modules",
  "test",
  "temp",
  "tmp",
  "coverage",
  CONFIG_FILENAME,
  ".rsync-partial",
]

const excludeList = (exclude) =>
  (Array.isArray(exclude) ? exclude : exclude ? exclude.split(",") : []).map((dir) =>
    dir.trim()
  )

const excludes = (exclude) => {
  const dirs = new Set([...DEFAULT_EXCLUDES, ...excludeList(exclude)])
  return [...dirs].map((dir) => `--exclude='${dir}'`)
}

const ssh = (target, command) =>
  `ssh -l ${target.username}${target.port ? ` -p ${target.port}` : ""} ${target.host} '${command}'`

const copy = (target) =>
  [
    `rsync -avz --partial-dir=.rsync-partial --delete -e ${target.port ? `'ssh -p ${target.port}'` : "ssh"}`,
    ...excludes(target.exclude),
    `${target.source || "./"} ${target.username}@${target.host}:${target.location}`,
  ].join(" ")

const editEnv = (target) =>
  `ssh -t -l ${target.username}${target.port ? ` -p ${target.port}` : ""} ${target.host} 'cd ${target.location} && \${EDITOR:-nano} .env'`

const parseEnvLines = (text) => text.replace(/^\uFEFF/, "").split(/\r?\n/)

const parseKeys = (text) =>
  parseEnvLines(text)
    .map((line) => line.split("=")[0].trim())
    .filter((key) => ENV_KEY.test(key))

const missingEnvLines = (example, keys) =>
  parseEnvLines(example).filter((line) => {
    if (!line.includes("=")) {
      return false
    }
    const key = line.split("=")[0].trim()
    return ENV_KEY.test(key) && !keys.includes(key)
  })

function envFileExists(target, exec) {
  try {
    exec(ssh(target, `test -f ${target.location}/.env`), { stdio: "pipe" })
    return true
  } catch (error) {
    if (error.status === 1) {
      return false
    }
    throw error
  }
}

function ensureEnv(target, { verbose = false, exec = execSync } = {}) {
  if (!fs.existsSync(ENV_EXAMPLE)) {
    return
  }
  if (envFileExists(target, exec)) {
    const output = run(ssh(target, `cut -d= -f1 ${target.location}/.env`), {}, exec)
    const example = fs.readFileSync(ENV_EXAMPLE, "utf8")
    const missing = missingEnvLines(example, parseKeys(output.toString()))
    if (missing.length === 0) {
      return
    }
    run(
      ssh(target, `cat >> ${target.location}/.env`),
      { input: "\n" + missing.join("\n") + "\n" },
      exec
    )
    console.log(
      `added missing keys to ${target.location}/.env: ${parseKeys(missing.join("\n")).join(", ")}`
    )
  } else {
    run(
      `scp ${target.port ? `-P ${target.port} ` : ""}${ENV_EXAMPLE} ${target.username}@${target.host}:${target.location}/.env`,
      { inherit: verbose },
      exec
    )
    console.log(`seeded ${target.location}/.env from ${ENV_EXAMPLE}`)
  }
  if (process.stdin.isTTY) {
    run(editEnv(target), { inherit: true }, exec)
  } else {
    throw new Error(
      `fill in real values in ${target.location}/.env on the server and redeploy`
    )
  }
}

const hooks = (target, phase) =>
  [].concat(target[phase] || []).map((command) =>
    ssh(target, `cd ${target.location} && ${command}`)
  )

const strategies = {
  Static: (target) => [
    ssh(target, `mkdir -p ${target.location}`),
    ...hooks(target, "before"),
    copy(target),
    ...hooks(target, "after"),
  ],
  MyDevilNet: (target) => [
    ssh(target, `mkdir -p ${target.location}`),
    { description: `ensure ${target.location}/.env is complete`, execute: ensureEnv },
    ...hooks(target, "before"),
    copy(target),
    ssh(
      target,
      `cd ${target.location} && ${target.npm || "npm"} install --production --omit=dev --silent --no-optional`
    ),
    ssh(target, `devil www restart ${target.domain}`),
    ...hooks(target, "after"),
  ],
}

function validate(target) {
  const errors = []
  if (!target.strategy) {
    errors.push(`"strategy" is required`)
  } else if (!Object.hasOwn(strategies, target.strategy)) {
    errors.push(
      `unknown strategy "${target.strategy}", available: ${Object.keys(strategies).join(", ")}`
    )
  }
  const required = Object.hasOwn(REQUIRED, target.strategy)
    ? REQUIRED[target.strategy]
    : ["username", "host", "location"]
  for (const key of required) {
    if (!target[key]) {
      errors.push(`"${key}" is required`)
    }
  }
  for (const key of ["username", "host", "domain", "location", "source", "npm"]) {
    if (target[key] && UNSAFE_CHARACTERS.test(target[key])) {
      errors.push(`"${key}" contains unsupported characters (whitespace, quotes or shell symbols)`)
    }
  }
  for (const dir of excludeList(target.exclude)) {
    if (UNSAFE_CHARACTERS.test(dir)) {
      errors.push(`exclude "${dir}" contains unsupported characters (whitespace, quotes or shell symbols)`)
    }
  }
  if (target.port !== undefined && !Number.isInteger(target.port)) {
    errors.push(`"port" must be an integer`)
  }
  if (target.url && !/^https?:\/\//.test(target.url)) {
    errors.push(`"url" must start with http:// or https://`)
  }
  for (const phase of ["before", "after"]) {
    for (const command of [].concat(target[phase] || [])) {
      if (command.includes("'")) {
        errors.push(`${phase} command "${command}" must not contain single quotes`)
      }
    }
  }
  return errors
}

function load(cwd, name, configPath = CONFIG_FILENAME) {
  let filepath = path.resolve(cwd, configPath)
  if (fs.existsSync(filepath) && fs.statSync(filepath).isDirectory()) {
    filepath = path.join(filepath, CONFIG_FILENAME)
  }
  const label = path.relative(cwd, filepath) || filepath
  if (!fs.existsSync(filepath)) {
    throw new Error(`missing config file: ${label}`)
  }
  let config
  try {
    config = JSON.parse(fs.readFileSync(filepath, "utf8"))
  } catch (error) {
    throw new Error(`invalid json in ${label}: ${error.message}`)
  }
  const names = Object.keys(config.targets || {})
  if (names.length === 0) {
    throw new Error(`config must define at least one target in "targets"`)
  }
  if (!name && names.length > 1) {
    throw new Error(`multiple targets available, pick one of: ${names.join(", ")}`)
  }
  name = name || names[0]
  if (!Object.hasOwn(config.targets, name)) {
    throw new Error(`unknown target "${name}", available: ${names.join(", ")}`)
  }
  const target = config.targets[name]
  const errors = validate(target)
  if (errors.length > 0) {
    throw new Error(
      [`invalid target "${name}":`, ...errors.map((error) => `  - ${error}`)].join("\n")
    )
  }
  return { name, target }
}

const diffCommand = (target) => copy(target).replace("rsync -avz", "rsync -avzn")

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function check(url) {
  let response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10000) })
  } catch (error) {
    throw new Error(`verification failed: ${url} - ${error.cause?.message || error.message}`)
  }
  if (!response.ok) {
    throw new Error(`verification failed: ${url} responded with ${response.status}`)
  }
  return response
}

async function verify(target, { attempts = 3, delay = 5000 } = {}) {
  if (!target.url) {
    return
  }
  try {
    const response = await check(target.url)
    console.log(`${target.url} responded with ${response.status}`)
  } catch (error) {
    if (attempts <= 1) {
      throw error
    }
    await sleep(delay)
    return verify(target, { attempts: attempts - 1, delay })
  }
}

function run(command, { inherit = false, input } = {}, exec = execSync) {
  try {
    return exec(command, {
      stdio: inherit ? "inherit" : "pipe",
      input,
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (error) {
    const output = [error.stderr, error.stdout]
      .map((stream) => (stream ? stream.toString().trim() : ""))
      .filter(Boolean)
      .join("\n")
    throw new Error([`command failed: ${command}`, output].filter(Boolean).join("\n"))
  }
}

async function deploy(target, { dryRun = false, verbose = false } = {}) {
  for (const entry of strategies[target.strategy](target)) {
    if (typeof entry === "string") {
      if (verbose || dryRun) {
        console.log(entry)
      }
      if (!dryRun) {
        run(entry, { inherit: verbose })
      }
    } else {
      if (verbose || dryRun) {
        console.log(`# ${entry.description}`)
      }
      if (!dryRun) {
        entry.execute(target, { verbose })
      }
    }
  }
  if (!dryRun) {
    await verify(target)
  }
}

module.exports = {
  CONFIG_FILENAME,
  strategies,
  load,
  deploy,
  run,
  diffCommand,
  verify,
  ensureEnv,
  parseKeys,
  missingEnvLines,
}
