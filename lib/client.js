'use strict';

var SockJS = require('sockjs-client/dist/sockjs');
var querystring = require('querystring');
var url = require('url');
var utils = require('../utils/client');
var {
    Placement,
    Update,
} = require('./effectTag');

var Client = function () {
    this.sock = null;
    this.retries = 0;
    this.currentHash = null;
    this.checkTriggered = false;
    this.currentHtml = this.getCurrentHtml();

    /** @type {Client} */
    var self = this;

    this.onSocketMsg = {
        'html-check': function (checkedHtml) {
            if (checkedHtml === self.currentHtml) {
                utils.log('Checking for html updates on the server...');
                self.checkTriggered = true;
            }
        },
        'html-hash': function (assetMap) {
            var asset = assetMap[self.currentHtml];
            var newHash = asset.hash

            if (!self.currentHash) {
                self.currentHash = newHash;
                self.checkTriggered = false;
            } else if (self.currentHash !== newHash) {
                // window.location.reload();
                self.commitEffect(asset.effect)
                self.currentHash = newHash
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

Client.prototype.getCurrentHtml = function () {
    var html = document.querySelector('html');
    var name = html.dataset.hwhpPagename;
    delete html.dataset.hwhpPagename;
    return name;
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

var createElementByEffect = function (effect) {
    var root = null;
    /** @type {HTMLElement} */
    var parent = null;
    var helper = function (effect) {
        /** @type {string} */
        var tag = effect.tag;
        var updatePayload = effect.updatePayload || [];
        var elt
        if (tag === 'text') {
            elt = document.createTextNode(updatePayload[0])
        } else {
            elt = document.createElement(tag);
            for (var i = 0; i < updatePayload.length; i++) {
                var update = updatePayload[i];
                var attrName = update[0];
                var value = update[1];
                elt.setAttribute(attrName, value);
            }
        }
        utils.tagAllDomNode(elt)

        if (root === null) {
            root = parent = elt;
        } else {
            parent.appendChild(elt)
        }

        parent = elt
        for (var i = 0; i < effect.children.length; i++) {
            helper(effect.children[i])
        }

        parent = elt.parentElement
    };
    helper(effect)
    return root
};

var reload = function () {
    utils.log('Html content base changed. Reloading...');
    window.location.reload();
};

/**
 * @param {Node} element
 * @param {Node} parent
 * @param {*} effect
 */
var commitEffect = function (element, parent, effect) {
    switch (effect.effect) {
        case Update:
            if (!element) {
                // The template element was not existed. (It might be deleted during script execution)
                // A full reload is needed.
                return reload()
            }
            var updatePayload = effect.updatePayload
            if (effect.tag === 'text') {
                if (element.nodeType !== 3 || element.nodeValue !== updatePayload[1]) {
                    return reload();
                }
                element.nodeValue = updatePayload[0]
                break;
            }
            if (element.tagName.toLowerCase() !== effect.tag) {
                return reload()
            }
            for (var i = 0; i < updatePayload.length; i++) {
                var update = updatePayload[i];
                var attrName = update[0];
                var newValue = update[1];
                var oldValue = update[2];
                if (
                    oldValue === undefined
                    || oldValue === element.getAttribute(attrName)
                ) {
                    element.setAttribute(attrName, newValue);
                } else {
                    // need to reload
                    return reload();
                }
            }
            break;
        case Placement:
            let newElt = createElementByEffect(effect)
            let beforeElt = element
            if (beforeElt && !utils.isTempalteNode(beforeElt)) {
                // A new element was inserted during script execution, and we could not figure
                // out which place it was inserted exactly:
                //   1. It might be appended into the end of the parent element, which means we should
                //      insert the added element before inserted element.
                //   2. Or It was inserted exactly after an element, which means we should insert the
                //      added element after inserted element.
                // So we can't determine where to insert the added element. A full reload is needed
                return reload()
            }
            beforeElt
                ? parent.insertBefore(newElt, beforeElt)
                : parent.append(newElt)
            return;
        default:
            break;
    }

    for (var i = 0; i < effect.children.length; i++) {
        commitEffect(element.childNodes[i] || null, element, effect.children[i])
    }
}

Client.prototype.commitEffect = function (effect) {
    if (effect === null) {
        return reload()
    }

    utils.log('Html content base changed. Commiting effect...');
    var domRoot = document.children[0]
    commitEffect(domRoot, null, effect)
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

Client.prototype.tagAllElements = function () {
    var rootElement = document.children[0]
    utils.tagAllDomNode(rootElement)
};

Client.prototype.run = function () {
    var urlParts = utils.getCurrentUrlParts();
    var socketUrl = this.getSocketUrl(urlParts);
    this.initSocket(socketUrl, this.onSocketMsg);
    this.tagAllElements();
    utils.log('html-webpack-hot-plugin enabled.');
};

new Client().run();

