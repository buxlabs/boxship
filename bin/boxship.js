#!/usr/bin/env node

const { parseArgs } = require("node:util")
const { CONFIG_FILENAME, loadConfig, selectTarget, validateTarget } = require("../src/config")
const deploy = require("../src/deploy")

const usage = `usage: boxship [target] [options]

deploys the target defined in ${CONFIG_FILENAME} (the target name
can be omitted when the config defines exactly one target)

options:
  --dry-run   print the commands without executing them
  --verbose   log deployment stages and command output
  --help      show this message
`

let args
try {
  args = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  })
} catch (error) {
  console.error(error.message)
  console.error(usage)
  process.exit(1)
}

if (args.values.help) {
  console.log(usage)
  process.exit(0)
}

try {
  const config = loadConfig(process.cwd())
  const { name, target } = selectTarget(config, args.positionals[0])
  const errors = validateTarget(target)
  if (errors.length > 0) {
    console.error(`invalid target "${name}":`)
    for (const error of errors) {
      console.error(`  - ${error}`)
    }
    process.exit(1)
  }
  deploy(target, {
    dryRun: args.values["dry-run"],
    verbose: args.values.verbose,
  })
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
