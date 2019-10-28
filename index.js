const sockjs = require('sockjs')

const {
    getHash,
} = require('./utils/hash')
const {
    cleanCompileAssets,
} = require('./utils/clean')
const logger = require('./utils/logger')
const {
    parseHtml,
    diffVnode,
} = require('./lib/vnode')


module.exports = class HtmlWebpackHotPlugin {
    constructor(options = {}) {
        this.needReload = false
        this.assetMap = {}
        this._devServer = null
        this.listened = false
        this.options = {
            hot: true,
            ...options,
        }

        /** @type {import('sockjs').Connection[]} */
        this.connections = []
    }

    /**
     * @param {import('webpack').Compiler} compiler
     */
    apply(compiler) {
        this.addClientEntry(compiler)

        compiler.plugin('compilation', (compilation) => {
            compilation.plugin('html-webpack-plugin-after-html-processing', data => {
                const { html: rawHtml, outputName } = data

                this.connWrite('html-check', outputName)

                const cleanHtml = cleanCompileAssets(compilation.assets, rawHtml)
                this.updateAsset(outputName, cleanHtml)

                // append html output name
                const injectedHtml = rawHtml.replace(/(<html[^>]*)>/, `$1 data-hwhp-pagename=${outputName}>`)
                data.html = injectedHtml
            })
            // compilation.plugin('html-webpack-plugin-after-emit', data => {
            //     this.sendStats()
            // })
        })

        compiler.plugin('done', () => {
            this.sendStats()
            if (!this.listened) {
                this.listen()
                this.listened = true
            }
        })
    }

    updateAsset(name, newHtml) {
        // calculate hash
        let hash = getHash(newHtml)
        // if not hot
        if (!this.options.hot) {
            this.assetMap[name] = {
                hash,
                effect: null,
            }
            return
        }
        // calculate differences
        let workInProgressRoot = parseHtml(newHtml)
        if (name in this.assetMap) {
            let oldAsset = this.assetMap[name]
            let root = oldAsset.root
            let effect = diffVnode(root, workInProgressRoot)
            this.assetMap[name] = {
                hash,
                effect,
                root: workInProgressRoot,
            }
        } else {
            this.assetMap[name] = {
                hash,
                effect: null,
                root: workInProgressRoot,
            }
        }
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
            let assetMap = {}
            for (let [name, asset] of Object.entries(this.assetMap)) {
                assetMap[name] = {
                    hash: asset.hash,
                    effect: asset.effect,
                }
            }
            devServer.sockWrite(connections, 'html-hash', assetMap)
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

            let server = this._devServer

            if (
                server.checkHost && !server.checkHost(connection.headers)
            ) {
                this._devServer.sockWrite([connection], 'error', 'Invalid Host header')

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

        if (!this._devServer.listeningApp) {
            logger.compatError('devServer.listeningApp')
            process.exit(1)
        }

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
        for (let api of ['sockWrite']) {
            if (!server[api]) {
                logger.compatError(`devServer.${api}`)
                process.exit(1)
            }
        }
    }
}
