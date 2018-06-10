const Strategy = require('../Strategy')

class MyDevilNetStrategy extends Strategy {
  clean() {
    this.ssh(`rm -rf ${this.location}/*`)
  }
  copy() {
    this.ssh(`mkdir -p ${this.location}`)
    this.exec(`scp -r ${this.source} ${this.username}@${this.host}:${this.location}`, { silent: this.silent });
  }
  install() {
    this.ssh('npm install --production --silent')
  }
  restart() {
    this.ssh(`devil www restart ${this.domain}`)
  }
  ssh(command) {
    this.exec(`ssh -l ${this.username} ${this.host} '${command}'`, { silent: this.silent });
  }
}

module.exports = MyDevilNetStrategy
