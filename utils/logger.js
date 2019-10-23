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
    error(msg) {
        log(chalk.red(msg))
    },
    compatError(api) {
        this.error(`There seems a bug in \`html-webpack-hot-plugin\` that ${api} doesn't exists.`)
        this.error(`Please try webpack-dev-server under version "3.3.1"`)
        this.error(`And open an issue here https://github.com/cxphoe/html-webpack-hot-plugin/issues`)
    },
}

module.exports = logger
