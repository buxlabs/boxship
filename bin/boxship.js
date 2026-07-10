#!/usr/bin/env node

const { parseArgs } = require("node:util")
const { CONFIG_FILENAME, load, deploy } = require("../src/boxship")

const usage = `usage: boxship [target] [options]

deploys the target defined in ${CONFIG_FILENAME} (the target name
can be omitted when the config defines exactly one target)

options:
  --dry-run   print the commands without executing them
  --verbose   log each command and its output
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
  console.error(`${error.message}\n${usage}`)
  process.exit(1)
}

if (args.values.help) {
  console.log(usage)
  process.exit(0)
}

try {
  const target = load(process.cwd(), args.positionals[0])
  deploy(target, {
    dryRun: args.values["dry-run"],
    verbose: args.values.verbose,
  })
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
