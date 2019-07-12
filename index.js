const sockjs = require('sockjs')

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
        this._devServer = null
        this.listened = false

        /** @type {import('sockjs').Connection[]} */
        this.connections = []
    }

    /**
     * @param {import('webpack').Compiler} compiler
     */
    apply(compiler) {
        this.addClientEntry(compiler)

        compiler.plugin('compilation', (compilation) => {
            compilation.plugin('html-webpack-plugin-before-html-processing', data => {
                const { html: rawHtml, outputName } = data

                this.connWrite('html-check', outputName)

                // calculate hash
                const cleanHtml = cleanCompileAssets(compilation.assets, rawHtml)
                const hash = getHash(cleanHtml)
                this.assetHashMap[outputName] = hash

                // append html output name
                const bodyEnd = rawHtml.lastIndexOf('</body>')
                const insertHtml = `
                    <!-- [begin] -->
                    <!-- the following content is added by \`html-webpack-hot-plugin\` -->
                    <div id='html-webpack-hot-plugin' style="display:none;">${outputName}</div>
                    <!-- [end] -->
                `
                data.html = rawHtml.substring(0, bodyEnd) + insertHtml + rawHtml.substring(bodyEnd)
            })
            compilation.plugin('html-webpack-plugin-after-emit', data => {
                this.sendStats()
            })
        })

        compiler.plugin('done', () => {
            this.sendStats()
            if (!this.listened) {
                this.listen()
                this.listened = true
            }
        })
    }

    /**
     * @param {import('webpack').Compiler} compiler
     */
    addClientEntry(compiler) {
        const clientEntry = 'html-webpack-hot-plugin/lib/client'
        const { entry } = compiler.options
        const addEntry = (entry) => {
            if (typeof entry === 'string') {
                return [
                    clientEntry,
                    entry,
                ]
            } else if (Array.isArray(entry)) {
                return [
                    clientEntry,
                    ...entry,
                ]
            } else {
                const newEntrys = {}
                Object.keys(entry).forEach((entryName) => {
                    newEntrys[entryName] = addEntry(entry[entryName])
                })
                return newEntrys
            }
        }
        compiler.options.entry = addEntry(entry)
    }

    checkDevServer() {
        if (!this._devServer) {
            logger.log()
            logger.warn('The `DevServer` of instance of HtmlWebpackHotPlugin is not setup.')
            logger.warn('The update of HtmlWebpackHotPlugin will not be catched and the opened page will not reload automatically.')
            logger.warn('Please use `setDevServer` method of the instance if you need a reload for html update.')
            logger.log()
        }
        return !!this._devServer
    }

    connWrite(type, payload) {
        this._devServer.sockWrite(this.connections, type, payload)
    }

    sendStats(connections) {
        if (this.checkDevServer()) {
            const devServer = this._devServer

            connections = connections || this.connections
            devServer.sockWrite(connections, 'html-hash', this.assetHashMap)
        }
    }

    listen() {
        const socket = sockjs.createServer({
            // Use provided up-to-date sockjs-client
            // sockjs_url: '/__webpack_dev_server__/sockjs.bundle.js',
            // Limit useless logs
            log: (severity, line) => {
                if (severity === 'error') {
                    logger.warn(line)
                } else {
                    logger.info(line)
                }
            },
        })

        socket.on('connection', (connection) => {
            if (!connection) {
                return
            }

            if (
                !this._devServer.checkHost(connection.headers) ||
                !this._devServer.checkOrigin(connection.headers)
            ) {
                this._devServer.sockWrite([connection], 'error', 'Invalid Host/Origin header')

                connection.close()

                return
            }

            this.connections.push(connection)

            connection.on('close', () => {
                const idx = this.connections.indexOf(connection)

                if (idx >= 0) {
                    this.connections.splice(idx, 1)
                }
            })

            this.sendStats([connection])
        })

        socket.installHandlers(this._devServer.listeningApp, {
            prefix: '/sockjs-node-html',
        })
    }

    /**
     *
     * @param {import('webpack-dev-server/lib/Server')} server
     */
    setDevServer(server) {
        this._devServer = server
    }
}
