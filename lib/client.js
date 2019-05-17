'use strict';

var SockJS = require('sockjs-client/dist/sockjs');
var querystring = require('querystring');
var url = require('url');
var utils = require('../utils/client');

var Client = function () {
    this.sock = null;
    this.retries = 0;
    this.currentHash = null;
    this.checkTriggered = false;
    this.currentHtml = document.getElementById('html-webpack-hot-plugin').innerText;

    /** @type {Client} */
    var self = this;

    this.onSocketMsg = {
        'html-check': function (checkedHtml) {
            if (checkedHtml === self.currentHtml) {
                utils.log('Checking for html updates on the server...');
                self.checkTriggered = true;
            }
        },
        'html-hash': function (hashMap) {
            var newHash = hashMap[self.currentHtml];

            if (!self.currentHash) {
                self.currentHash = newHash;
                self.checkTriggered = false;
            } else if (self.currentHash !== newHash) {
                utils.log('Html content base changed. Reloading...');
                window.location.reload();
            } else if (self.checkTriggered) {
                utils.log('No changes to the current HTML file were detected.')
                self.checkTriggered = false;
            }
        },
        log: function (msg) {
            utils.log(msg);
        },
        close: function () {
            utils.log('Disconnected!');
        },
    };
}

Client.prototype.getSocketUrl = function (urlParts) {
    var hostname = urlParts.hostname;
    var protocol = urlParts.protocol;
    var port = urlParts.port; // check ipv4 and ipv6 `all hostname`

    if (hostname === '0.0.0.0' || hostname === '::') {
        // why do we need this check?
        // hostname n/a for file protocol (example, when using electron, ionic)
        // see: https://github.com/webpack/webpack-dev-server/pull/384
        // eslint-disable-next-line no-bitwise
        if (self.location.hostname && !!~self.location.protocol.indexOf('http')) {
            hostname = self.location.hostname;
            port = self.location.port;
        }
    } // `hostname` can be empty when the script path is relative. In that case, specifying
    // a protocol would result in an invalid URL.
    // When https is used in the app, secure websockets are always necessary
    // because the browser doesn't accept non-secure websockets.


    if (hostname && (self.location.protocol === 'https:' || urlParts.hostname === '0.0.0.0')) {
        protocol = self.location.protocol;
    }

    var socketUrl = url.format({
        protocol: protocol,
        auth: urlParts.auth,
        hostname: hostname,
        port: port,
        // If sockPath is provided it'll be passed in via the __resourceQuery as a
        // query param so it has to be parsed out of the querystring in order for the
        // client to open the socket to the correct location.
        pathname: urlParts.path == null || urlParts.path === '/'
            ? '/sockjs-node-html'
            : querystring.parse(urlParts.path).sockPath || urlParts.path,
    });

    return socketUrl;
};

Client.prototype.initSocket = function (url, handlers) {
    var sock = this.sock = new SockJS(url);
    var self = this;

    sock.onopen = function onopen() {
        self.retries = 0;
    };

    sock.onclose = function onclose() {
        if (self.retries === 0) {
            handlers.close();
        } // Try to reconnect.


        self.sock = null; // After 10 retries stop trying, to prevent logspam.

        if (self.retries <= 10) {
            // Exponentially increase timeout to reconnect.
            // Respectfully copied from the package `got`.
            // eslint-disable-next-line no-mixed-operators, no-restricted-properties
            var retryInMs = 1000 * Math.pow(2, self.retries) + Math.random() * 100;
            self.retries += 1;
            setTimeout(function () {
                self.initSocket(url, handlers);
            }, retryInMs);
        }
    };

    sock.onmessage = function onmessage(e) {
        // This assumes that all data sent via the websocket is JSON.
        var msg = JSON.parse(e.data);

        if (handlers[msg.type]) {
            handlers[msg.type](msg.data);
        }
    };
};

Client.prototype.run = function () {
    var urlParts = utils.getCurrentUrlParts();
    var socketUrl = this.getSocketUrl(urlParts);
    this.initSocket(socketUrl, this.onSocketMsg);
    utils.log('html-webpack-hot-plugin enabled.');
};

new Client().run();

