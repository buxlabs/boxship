const Strategy = require('../Strategy')

class MyDevilNetStrategy extends Strategy {
  clean() {
    this.ssh(`rm -rf ${this.location}/*`)
  }
  copy() {
    this.ssh(`mkdir -p ${this.location}`)
    const cmd = ['rsync -avz -e ssh']
    if (this.exclude) cmd.push(`--exclude='${this.exclude}'`)
    cmd.push(`${this.source} ${this.username}@${this.host}:${this.location}`)
    this.exec(cmd.join(" "), { silent: this.silent });
  }
  install() {
    this.ssh(`cd ${this.location} && npm install --production --silent`)
  }
  restart() {
    this.ssh(`devil www restart ${this.domain}`)
  }
  ssh(command) {
    this.exec(`ssh -l ${this.username} ${this.host} '${command}'`, { silent: this.silent });
  }
}

module.exports = MyDevilNetStrategy
