const Strategy = require('../Strategy')

class MyDevilNetStaticStrategy extends Strategy {
  clean() {
    this.ssh(`rm -rf ${this.location}/*`)
  }
  copy() {
    this.ssh(`mkdir -p ${this.location}`)
    const cmd = ['rsync -av']
    if (this.exclude) cmd.push(`--exclude='${this.exclude}'`)
    cmd.push(`${this.source} ${this.username}@${this.host}:${this.location}`)
    this.exec(cmd.join(" "), { silent: this.silent });
  }
  restart() {
    this.ssh(`devil www restart ${this.domain}`)
  }
  ssh(command) {
    this.exec(`ssh -l ${this.username} ${this.host} '${command}'`, { silent: this.silent });
  }
  deploy() {
    this.log('deploy:start')
    this.log('stage:clean')
    this.clean()
    this.log('stage:copy')
    this.copy()
    this.log('stage:restart')
    this.restart()
    this.log('deploy:stop')
  }
}

module.exports = MyDevilNetStaticStrategy
