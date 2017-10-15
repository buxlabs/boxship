const minimist = require('minimist')
const deploy = require('../src/deploy')
const strategies = require('../src/strategies')
const options = minimist(process.argv.slice(2))
const Strategy = strategies[options.strategy]

deploy(options, Strategy)
