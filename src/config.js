const fs = require("fs")
const path = require("path")
const strategies = require("./strategies")

const CONFIG_FILENAME = "boxship.config.json"

function loadConfig(cwd) {
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
  const targets = config.targets
  if (!targets || typeof targets !== "object" || Object.keys(targets).length === 0) {
    throw new Error(`config must define at least one target in "targets"`)
  }
  return config
}

function selectTarget(config, name) {
  const names = Object.keys(config.targets)
  if (!name) {
    if (names.length === 1) {
      name = names[0]
    } else {
      throw new Error(`multiple targets available, pick one of: ${names.join(", ")}`)
    }
  }
  if (!config.targets[name]) {
    throw new Error(`unknown target "${name}", available: ${names.join(", ")}`)
  }
  return { name, target: config.targets[name] }
}

function validateTarget(target) {
  const errors = []
  if (!target.strategy) {
    errors.push(`"strategy" is required`)
  } else if (!strategies[target.strategy]) {
    errors.push(
      `unknown strategy "${target.strategy}", available: ${Object.keys(strategies).join(", ")}`
    )
  }
  for (const key of ["username", "host", "location"]) {
    if (!target[key]) {
      errors.push(`"${key}" is required`)
    }
  }
  if (target.strategy === "MyDevilNet" && !target.domain) {
    errors.push(`"domain" is required for the MyDevilNet strategy`)
  }
  return errors
}

module.exports = { CONFIG_FILENAME, loadConfig, selectTarget, validateTarget }
