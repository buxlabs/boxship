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
    this.source = options.source || "*"
    this.exclude = options.exclude
    this.port = options.port
    this.npm = options.npm || "npm"
    this.stages = {
      clean: true,
      copy: true,
      install: false,
      restart: false,
    }
  }

  deploy() {
    this.log("deploy:start")
    if (this.stages.clean) {
      this.log("stage:clean")
      this.clean()
    }
    if (this.stages.copy) {
      this.log("stage:copy")
      this.copy()
    }
    if (this.stages.install) {
      this.log("stage:install")
      this.install()
    }
    if (this.stages.restart) {
      this.log("stage:restart")
      this.restart()
    }
    this.log("deploy:stop")
  }

  log(message) {
    if (this.verbose) {
      this.logger.log(message)
    }
  }

  clean() {}
  copy() {}
  install() {}
  restart() {}
}

module.exports = Strategy
