const { execSync } = require("child_process")
const strategies = require("./strategies")

module.exports = function deploy(target, { dryRun = false, verbose = false } = {}) {
  const Strategy = strategies[target.strategy]
  const exec = dryRun
    ? (command) => console.log(command)
    : (command, { silent } = {}) =>
        execSync(command, { stdio: silent ? "pipe" : "inherit" })

  const strategy = new Strategy({
    ...target,
    verbose,
    logger: { log: console.log },
    exec,
  })

  strategy.deploy()
}
