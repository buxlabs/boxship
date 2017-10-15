const Strategy = require('../Strategy')

class MyDevilNetStrategy extends Strategy {
  clean() {
    this.exec(`ssh -l ${this.username} ${this.host} 'rm -rf ${this.location}/public/*'`, { silent: true });
  }
  copy() {
    this.exec(`scp -r build/* ${this.username}@${this.host}:${this.location}/public`, { silent: true });
  }
  restart() {
    this.exec(`ssh -l ${this.username} ${this.host} 'devil www restart ${this.domain}'`, { silent: true });
  }
}

module.exports = MyDevilNetStrategy
