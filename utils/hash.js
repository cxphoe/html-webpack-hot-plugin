const crypto = require('crypto')

/** md5 */
const getHash = (str = '') => {
    const hash = crypto.createHash('md5')
    hash.update(str)
    return hash.digest('hex')
}

module.exports = {
    getHash,
}
