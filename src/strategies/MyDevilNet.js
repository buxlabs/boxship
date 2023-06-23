const Strategy = require("../Strategy")

function normalizeExclude(exclude) {
  if (exclude.includes(",")) {
    const parts = exclude.split(",")
    const text = `{${parts.map((part) => `'${part}'`).join(",")}}`
    return text
  }
  return `'${exclude}'`
}

class MyDevilNetStrategy extends Strategy {
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
