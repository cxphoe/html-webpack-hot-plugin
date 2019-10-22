const htmlparser2 = require("htmlparser2")
const logger = require('../utils/logger')
const Tag = require('./effectTag')


const createElement = (tag, props) => {
    return {
        tag,
        props,
        children: [],

        parent: null,
    }
}

const createEffect = (tag, props) => {
    return {
        tag,
        updatePayload: null,
        effect: Tag.NoEffect,
        children: [],
    }
}

const appendChild = (node, child) => {
    node.children.push(child)
}

const dummyNode = createElement('dummy', null)

const parseHtml = (html) => {
    dummyNode.children = []
    let parent = dummyNode
    const parser = new htmlparser2.Parser({
        onopentag(name, attrs) {
            let child = createElement(name, attrs)
            appendChild(parent, child)
            child.parent = parent
            parent = child
        },
        ontext(text) {
            let child = createElement('text', text)
            appendChild(parent, child)
        },
        onclosetag(tagname) {
            if (parent === dummyNode) {
                logger.error(`Incorrect tag nesting \`${tagname}\``)
                process.exit(1)
            }
            let next = parent.parent
            parent = next
        },
    }, {
        decodeEntities: true,
    });
    parser.write(html)
    parser.end()

    let root = dummyNode.children[0]
    root.parent = null
    dummyNode.children = []
    return root
}


const diffProperties = (oldProps, newProps) => {
    if (typeof oldProps === 'string' || typeof newProps === 'string') {
        return oldProps === newProps ? null : [newProps || '', oldProps || '']
    }
    let oldKeys = Object.keys(oldProps)
    let newKeys = Object.keys(newProps)
    let updatePayload = []
    for (let k of oldKeys) {
        if (!(k in newProps)) {
            updatePayload.push([k, '', oldProps[k]])
        }
    }

    for (let k of newKeys) {
        let newProp = newProps[k]
        let oldProp = oldProps[k]
        if (newProp !== oldProp) {
            updatePayload.push([k, newProp, oldProp])
        }
    }
    return updatePayload.length > 0 ? updatePayload : null
}

const diffVnode = (root, workInProgressRoot) => {
    dummyNode.children = []
    let needReload = false
    const helper = (current, workInProgress, parent) => {
        if (workInProgress === null) {
            needReload = true
        }
        if (needReload) {
            return
        }

        let diffNode = createEffect(workInProgress.tag)
        if (current === null) {
            // workInProgress is new content
            diffNode.effect = Tag.Placement
            diffNode.updatePayload = diffProperties({}, workInProgress.props)
        } else if (workInProgress === null || current.tag !== workInProgress.tag) {
            // This involves a deletion. A reload is needed to performed
            needReload = true
            return
        } else {
            diffNode.updatePayload = diffProperties(current.props, workInProgress.props)
            if (diffNode.updatePayload) {
                // This is an update.
                diffNode.effect = Tag.Update
            }
        }
        appendChild(parent, diffNode)

        let childCount = Math.max(
            current ? current.children.length : 0,
            workInProgress.children.length
        )
        for (let i = 0; i < childCount; i++) {
            helper(
                (current && current.children[i]) || null,
                workInProgress.children[i] || null,
                diffNode,
            )
        }

    }

    helper(root, workInProgressRoot, dummyNode)
    if (needReload) {
        return null
    }

    let diffRoot = dummyNode.children[0]
    dummyNode.children = []
    return diffRoot
}

module.exports = {
    parseHtml,
    diffVnode,
}
