var tagKey = '__hwhp';

/**
 * tag all elements belonging to the HTML template
 * @param {Element} element
 */
var tagAllDomElement = function (element) {
    element[tagKey] = true
    for (let child of element.children) {
        tagAllDomElement(child)
    }
};

/**
 * tell if a element belongs to the HTML template
 * @param {Element} element
 */
var isTempalteElement = function (element) {
    return !!element[tagKey];
}

module.exports = {
    tagAllDomElement,
    isTempalteElement,
}

