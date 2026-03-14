// This file exports both configurations for convenience
const mainConfig = require('./webpack.main.config.js');
const rendererConfig = require('./webpack.renderer.config.js');

module.exports = [mainConfig, rendererConfig];
