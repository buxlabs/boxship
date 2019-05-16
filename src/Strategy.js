class Strategy {
  constructor(options) {
    this.username = options.username
    this.host = options.host
    this.domain = options.domain
    this.location = options.location
    this.logger = options.logger
    this.exec = options.exec
    this.verbose = options.verbose
    this.silent = !options.verbose
    this.source = options.source || '*'
    this.exclude = options.exclude
  }

  deploy() {
    this.log('deploy:start')
    this.log('stage:clean')
    this.clean()
    this.log('stage:copy')
    this.copy()
    this.log('stage:install')
    this.install()
    this.log('stage:restart')
    this.restart()
    this.log('deploy:stop')
  }

  log(message) {
    if (this.verbose) { this.logger.log(this.logger.format(message)) }
  }

  clean() {}
  copy() {}
  install() {}
  restart() {}
}

module.exports = Strategy
