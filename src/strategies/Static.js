const Strategy = require("../Strategy")

class StaticStrategy extends Strategy {
  clean() {
    this.ssh(`rm -rf ${this.location}/*`)
  }
  copy() {
    this.ssh(`mkdir -p ${this.location}`)
    const cmd = this.port
      ? [`rsync -avz -e 'ssh -p ${this.port}'`]
      : ["rsync -avz -e ssh"]
    cmd.push(...this.excludeFlags())
    cmd.push(`${this.source} ${this.username}@${this.host}:${this.location}`)
    this.exec(cmd.join(" "), { silent: this.silent })
  }
  ssh(command) {
    this.exec(
      this.port
        ? `ssh -l ${this.username} -p ${this.port} ${this.host} '${command}'`
        : `ssh -l ${this.username} ${this.host} '${command}'`,
      {
        silent: this.silent,
      }
    )
  }
}

module.exports = StaticStrategy
