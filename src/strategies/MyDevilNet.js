const Strategy = require('../Strategy')

class MyDevilNetStrategy extends Strategy {
  clean() {
    this.exec(`ssh -l ${this.username} ${this.host} 'rm -rf ${this.location}/*'`, { silent: this.silent });
  }
  copy() {
    this.exec(`ssh -l ${this.username} ${this.host} 'mkdir -p ${this.location}'`, { silent: this.silent })
    this.exec(`scp -r ${this.source} ${this.username}@${this.host}:${this.location}`, { silent: this.silent });
  }
  restart() {
    this.exec(`ssh -l ${this.username} ${this.host} 'devil www restart ${this.domain}'`, { silent: this.silent });
  }
}

module.exports = MyDevilNetStrategy
