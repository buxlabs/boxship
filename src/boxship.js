const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const CONFIG_FILENAME = "boxship.config.json"

const REQUIRED = {
  Static: ["username", "host", "location"],
  MyDevilNet: ["username", "host", "location", "domain"],
}

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

const excludes = (exclude) => {
  const custom = Array.isArray(exclude) ? exclude : exclude ? exclude.split(",") : []
  const dirs = new Set([...DEFAULT_EXCLUDES, ...custom.map((dir) => dir.trim())])
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

const strategies = {
  Static: (target) => [
    ssh(target, `mkdir -p ${target.location}`),
    copy(target),
  ],
  MyDevilNet: (target) => [
    ssh(target, `mkdir -p ${target.location}`),
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
  } else if (!strategies[target.strategy]) {
    errors.push(
      `unknown strategy "${target.strategy}", available: ${Object.keys(strategies).join(", ")}`
    )
  }
  for (const key of REQUIRED[target.strategy] || ["username", "host", "location"]) {
    if (!target[key]) {
      errors.push(`"${key}" is required`)
    }
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
  const target = config.targets[name]
  if (!target) {
    throw new Error(`unknown target "${name}", available: ${names.join(", ")}`)
  }
  const errors = validate(target)
  if (errors.length > 0) {
    throw new Error(
      [`invalid target "${name}":`, ...errors.map((error) => `  - ${error}`)].join("\n")
    )
  }
  return target
}

function deploy(target, { dryRun = false, verbose = false } = {}) {
  for (const command of strategies[target.strategy](target)) {
    if (verbose || dryRun) {
      console.log(command)
    }
    if (!dryRun) {
      execSync(command, { stdio: verbose ? "inherit" : "pipe" })
    }
  }
}

module.exports = { CONFIG_FILENAME, strategies, load, deploy }
