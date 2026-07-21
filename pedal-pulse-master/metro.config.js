const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .ogg to the list of assets that Metro bundles
if (!config.resolver.assetExts.includes('ogg')) {
    config.resolver.assetExts.push('ogg');
}

module.exports = config;
