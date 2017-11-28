const Strategy = require('../Strategy')

class MyDevilNetStrategy extends Strategy {
  clean() {
    this.exec(`ssh -l ${this.username} ${this.host} 'rm -rf ${this.location}/*'`, { silent: this.verbose });
  }
  copy() {
    const destination = `${this.location}`
    this.exec(`ssh -l ${this.username} ${this.host} 'mkdir -p ${destination}'`, { silent: this.verbose })
    this.exec(`scp -r build/* ${this.username}@${this.host}:${destination}`, { silent: this.verbose });
  }
  restart() {
    this.exec(`ssh -l ${this.username} ${this.host} 'devil www restart ${this.domain}'`, { silent: this.verbose });
  }
}

module.exports = MyDevilNetStrategy
