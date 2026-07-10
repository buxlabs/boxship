const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const CONFIG_FILENAME = "boxship.config.json"

const REQUIRED = {
  Static: ["username", "host", "location"],
  MyDevilNet: ["username", "host", "location", "domain"],
}

const UNSAFE_CHARACTERS = /[\s'"`$;&|<>()\\]/

const DEFAULT_EXCLUDES = [
  ".git",
  ".env",
  ".vscode",
  ".idea",
  ".DS_Store",
  "node_modules",
  "test",
  "coverage",
  CONFIG_FILENAME,
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
    `rsync -avz --delete -e ${target.port ? `'ssh -p ${target.port}'` : "ssh"}`,
    ...excludes(target.exclude),
    `${target.source || "./"} ${target.username}@${target.host}:${target.location}`,
  ].join(" ")

const ensureEnv = (target) => {
  const seed = `scp ${target.port ? `-P ${target.port} ` : ""}.env.example ${target.username}@${target.host}:${target.location}/.env`
  const edit = `ssh -t -l ${target.username}${target.port ? ` -p ${target.port}` : ""} ${target.host} 'cd ${target.location} && \${EDITOR:-nano} .env'`
  const message = `seeded ${target.location}/.env from .env.example - fill in real values on the server and redeploy`
  const abort = `(echo "${message}" >&2; exit 1)`
  return {
    command: `${ssh(target, `test -f ${target.location}/.env`)} || (${seed} && ([ -t 0 ] && ${edit} || ${abort}))`,
    interactive: true,
  }
}

const strategies = {
  Static: (target) => [
    ssh(target, `mkdir -p ${target.location}`),
    copy(target),
  ],
  MyDevilNet: (target) => [
    ssh(target, `mkdir -p ${target.location}`),
    ensureEnv(target),
    copy(target),
    ssh(
      target,
      `cd ${target.location} && ${target.npm || "npm"} install --production --omit=dev --silent --no-optional`
    ),
    ssh(target, `devil www restart ${target.domain}`),
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
  return errors
}

function load(cwd, name) {
  const filepath = path.join(cwd, CONFIG_FILENAME)
  if (!fs.existsSync(filepath)) {
    throw new Error(`missing config file: ${CONFIG_FILENAME}`)
  }
  let config
  try {
    config = JSON.parse(fs.readFileSync(filepath, "utf8"))
  } catch (error) {
    throw new Error(`invalid json in ${CONFIG_FILENAME}: ${error.message}`)
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

async function verify(target) {
  if (!target.url) {
    return
  }
  let response
  try {
    response = await fetch(target.url)
  } catch (error) {
    throw new Error(
      `verification failed: ${target.url} - ${error.cause?.message || error.message}`
    )
  }
  if (!response.ok) {
    throw new Error(`verification failed: ${target.url} responded with ${response.status}`)
  }
  console.log(`${target.url} responded with ${response.status}`)
}

function run(command, inherit) {
  try {
    execSync(command, { stdio: inherit ? "inherit" : "pipe" })
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
    const { command, interactive } = typeof entry === "string" ? { command: entry } : entry
    if (verbose || dryRun) {
      console.log(command)
    }
    if (!dryRun) {
      run(command, verbose || interactive)
    }
  }
  if (!dryRun) {
    await verify(target)
  }
}

module.exports = { CONFIG_FILENAME, strategies, load, deploy, run, diffCommand, verify }
