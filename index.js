const path = require('path')

const {
    getHash,
} = require('./utils/hash')
const {
    cleanCompileAssets,
} = require('./utils/clean')
const logger = require('./utils/logger')

module.exports = class HtmlWebpackHotPlugin {
    constructor() {
        this.needReload = false
        this.assetHashMap = {}
        this.accessedHtml = null
    }

    apply (compiler) {
        compiler.plugin('compilation', (compilation) => {
            compilation.plugin('html-webpack-plugin-before-html-processing', data => {
                const { html: rawHtml, outputName } = data
                const cleanHtml = cleanCompileAssets(compilation.assets, rawHtml)
                const hash = getHash(cleanHtml)

                if (outputName === this.accessedHtml) {
                    this.needReload = hash !== this.assetHashMap[outputName]
                }
                this.assetHashMap[outputName] = hash
            })
            compilation.plugin('html-webpack-plugin-after-emit', data => {
                if (this.needReload) {
                    this.afterEmit()
                }
            })
        })
    }

    afterEmit() {
        const devServer = this._devServer
        if (!devServer) {
            logger.log()
            logger.warn('The `DevServer` of instance of HtmlWebpackHotPlugin is not setup.')
            logger.warn('The update of HtmlWebpackHotPlugin will not be catched and the opened page will not reload automatically.')
            logger.warn('Please use `setDevServer` method of the instance if you need a reload for html update.')
            logger.log()
            return
        }

        logger.info('reloading...')
        devServer.sockWrite(devServer.sockets, 'content-changed')
    }

    setDevServer(server) {
        this._devServer = server
        // watch request of the user and detect which html file is accessed
        server.app.get('*', (req, res, next) => {
            const { url } = req
            if (path.extname(url) === '.html') {
                this.accessedHtml = url.slice(1)
            }
            next()
        })
    }
}
