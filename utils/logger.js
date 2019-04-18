const chalk = require('chalk')
const log = console.log.bind(null, '[HWHP]')

const logger = {
    log(msg) {
        console.log(msg || '')
    },
    info(msg) {
        log(chalk.blue(msg))
    },
    warn(msg) {
        log(chalk.yellow(msg))
    },
}

module.exports = logger
