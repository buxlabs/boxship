const Strategy = require("../Strategy")

class MyDevilNetStrategy extends Strategy {
  constructor(options) {
    super(options)
    this.stages.install = true
    this.stages.restart = true
  }
  clean() {
    this.ssh(`rm -rf ${this.location}/*`)
  }
  copy() {
    this.ssh(`mkdir -p ${this.location}`)
    const cmd = ["rsync -avz -e ssh"]
    cmd.push(...this.excludeFlags())
    cmd.push(`${this.source} ${this.username}@${this.host}:${this.location}`)
    this.exec(cmd.join(" "), { silent: this.silent })
  }
  install() {
    this.ssh(
      `cd ${this.location} && ${this.npm} install --production --omit=dev --silent --no-optional`
    )
  }
  restart() {
    this.ssh(`devil www restart ${this.domain}`)
  }
  ssh(command) {
    this.exec(`ssh -l ${this.username} ${this.host} '${command}'`, {
      silent: this.silent,
    })
  }
}

module.exports = MyDevilNetStrategy
