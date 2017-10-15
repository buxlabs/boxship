class Strategy {

  constructor(options) {
    this.username = options.username
    this.host = options.host
    this.domain = options.domain
    this.location = options.location
    this.verbose = options.verbose
    this.logger = options.logger
    this.exec = options.exec
  }

  deploy() {
    this.log('deploy: start')
    this.log('stage: clean')
    this.clean()
    this.log('stage: copy')
    this.copy()
    this.log('stage: restart')
    this.restart()
    this.log('deploy:stop')
  }

  log(message) {
    if (this.verbose) { this.logger.log(this.logger.format(message)) }
  }

  clean() {}
  copy() {}
  restart() {}
}

module.exports = Strategy
