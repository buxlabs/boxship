const Strategy = require("../Strategy")

function normalizeExclude(exclude) {
  if (exclude.includes(",")) {
    const parts = exclude.split(",")
    const text = `{${parts.map((part) => `'${part}'`).join(",")}}`
    return text
  }
  return `'${exclude}'`
}

class StaticStrategy extends Strategy {
  clean() {
    this.ssh(`rm -rf ${this.location}/*`)
  }
  copy() {
    this.ssh(`mkdir -p ${this.location}`)
    const cmd = ["rsync -avz -e ssh"]
    if (this.exclude) {
      cmd.push(`--exclude=${normalizeExclude(this.exclude)}`)
    }
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
