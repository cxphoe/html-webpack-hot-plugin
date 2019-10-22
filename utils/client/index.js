const url = require('url');
const tag = require('./tag');

var getCurrentScriptSource = function () {
    // `document.currentScript` is the most accurate way to find the current script,
    // but is not supported in all browsers.
    if (document.currentScript) {
        return document.currentScript.getAttribute('src');
    } // Fall back to getting all scripts in the document.


    var scriptElements = document.scripts || [];
    var currentScript = scriptElements[scriptElements.length - 1];

    if (currentScript) {
        return currentScript.getAttribute('src');
    } // Fail as there was no script to use.


    throw new Error('[HWHP] Failed to get current script source.');
};

var getCurrentUrlParts = function () {
    var scriptHref = getCurrentScriptSource();
    var scriptParts = url.parse(scriptHref);
    var scriptHost = (scriptParts.protocol && scriptParts.host)
        ? scriptParts.protocol + '//' + scriptParts.host
        : '/';

    var urlParts = url.parse(scriptHost, false, true);

    if (!urlParts.port || urlParts.port === '0') {
        urlParts.port = self.location.port;
    }

    return urlParts;
};

var log = console.log.bind(null, '[HWHP]');

module.exports = {
    getCurrentScriptSource,
    getCurrentUrlParts,
    log,
    ...tag,
};
