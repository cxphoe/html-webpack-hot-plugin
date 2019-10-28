var tagKey = '__hwhp';

/**
 * tag all elements belonging to the HTML template
 * @param {Node} node
 */
var tagAllDomNode = function (node) {
    node[tagKey] = true
    if (node.childNodes) {
        for (let child of node.childNodes) {
            tagAllDomNode(child)
        }
    }
};

/**
 * tell if a node belongs to the HTML template
 * @param {Node}} node
 */
var isTempalteNode = function (node) {
    return !!node[tagKey];
}

module.exports = {
    tagAllDomNode,
    isTempalteNode,
}

