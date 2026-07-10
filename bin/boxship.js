#!/usr/bin/env node

const { parseArgs } = require("node:util")
const { CONFIG_FILENAME, load, deploy, diffCommand, run } = require("../src/boxship")

const usage = `usage: boxship [target] [options]

deploys the target defined in ${CONFIG_FILENAME} (the target name
can be omitted when the config defines exactly one target)

options:
  --diff      show which files would be transferred and deleted
  --dry-run   print the commands without executing them
  --verbose   log each command and its output
  --help      show this message
`

let args
try {
  args = parseArgs({
    options: {
      diff: { type: "boolean", default: false },
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

async function main() {
  const { name, target } = load(process.cwd(), args.positionals[0])
  if (args.values.diff) {
    run(diffCommand(target), { inherit: true })
    return
  }
  const started = Date.now()
  await deploy(target, {
    dryRun: args.values["dry-run"],
    verbose: args.values.verbose,
  })
  if (!args.values["dry-run"]) {
    console.log(`deployed ${name} in ${((Date.now() - started) / 1000).toFixed(1)}s`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
