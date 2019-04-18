# HTML Webpack Hot Plugin

> HtmlWebpackPlugin with hot reload

When using webpack with hot module replacement, the update of html file in htmlWebpackPlugin will not trigger anything. And the notice in console will show something like "app is up to date". Refreshing the page manually is the only choice if you wanna see the latest update. And this plugin is for solving this. It will send signal to opened client when the content in htmlWebpackPlugin changes and a `full reload` will be triggered.

This is an extension of [HTMLWebpackPlugin](https://github.com/jantimon/html-webpack-plugin)
<p style="color:red">This is a tool just used in `Development` mode.</p>

## install

```
npm i --save-dev html-webpack-hot-plugin
```

```
yarn add --dev html-webpack-hot-plugin
```

## usage

### webpack.config.js

<span style="color:red">Notice:</span> Below configuration is for webpack4

```js
const HtmlWebpackPlugin = require('html-webpack-plugin')
const HtmlWebpackHotPlugin = require('html-webpack-hot-plugin')
const htmlHotPlugin = new HtmlWebpackHotPlugin()

module.exports = {
  entry: 'index.js',
  output: {
    path: __dirname + '/dist',
    filename: 'index_bundle.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'test.html',
      template: 'src/assets/test.html',
    }),
    // the instance of this plugin must be placed after instances of HtmlWebpackPlugin
    htmlHotPlugin,
  ],
  devServer: {
    before(app, server) {
      // This step is curcial. DevServer is needed to send reload message to opened page.
      // Without this step, the update of HtmlWebpackHotPlugin will be omitted and you will need to refresh the page manually.
      htmlHotPlugin.setDevServer(server)
    },
  },
}
```
