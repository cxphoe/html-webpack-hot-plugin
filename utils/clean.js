/** clean compiled assets which might contain hashed link in the html content */
const cleanCompileAssets = (assets, html) => {
    const links = Object.keys(assets)
    for (const link of links) {
        const regex = new RegExp(link, 'g')
        html = html.replace(regex, '')
    }
    return html
}

module.exports = {
    cleanCompileAssets,
}
