const shell = require('shelljs')
const chalk = require('chalk')

module.exports = function deploy (options, Strategy) {
  let strategy = new Strategy({
    username: options.username,
    host: options.host,
    domain: options.domain,
    location: options.location,
    verbose: options.verbose,
    source: options.source,
    exclude: options.exclude,
    logger: { log: console.log, format: chalk.green },
    exec: shell.exec
  })

  strategy.deploy()
}
