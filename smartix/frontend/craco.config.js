const path = require('path');

// Chemin réservé au WebSocket de hot reload de webpack.
// Le backend utilise déjà /ws pour ses WebSockets applicatifs : les séparer
// évite que le client CRA tente de parler au serveur Socket.IO avec le mauvais
// protocole et produise « Invalid frame header ».
const DEV_HMR_WEBSOCKET_PATH = '/__webpack_hmr';

module.exports = {
  babel: {
    presets: [
      ['@babel/preset-typescript', { allExtensions: true, isTSX: true }]
    ],
    plugins: []
  },
  devServer: (devServerConfig) => {
    devServerConfig.allowedHosts = 'all';
    devServerConfig.client = {
      ...(devServerConfig.client || {}),
      webSocketURL: {
        ...(devServerConfig.client?.webSocketURL || {}),
        pathname: DEV_HMR_WEBSOCKET_PATH,
      },
    };
    devServerConfig.webSocketServer = {
      type: 'ws',
      options: {
        path: DEV_HMR_WEBSOCKET_PATH,
      },
    };
    devServerConfig.headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-cache, no-store, must-revalidate, public, max-age=0'
    };
    return devServerConfig;
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src/'),
      'ioredis': path.resolve(__dirname, 'src/__mocks__/ioredis.js'),
      'redis': path.resolve(__dirname, 'src/__mocks__/redis.js'),
    },
    plugins: {
      add: [
        {
          apply: (compiler) => {
            compiler.hooks.normalModuleFactory.tap('NodeProtocolPlugin', (factory) => {
              factory.hooks.resolve.tap('NodeProtocolPlugin', (resolveData) => {
                if (resolveData.request && resolveData.request.startsWith('node:')) {
                  resolveData.request = resolveData.request.replace('node:', '');
                }
              });
            });
          }
        }
      ]
    },
    configure: (webpackConfig) => {
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        // Ignorer les warnings source-map des packages tiers @jridgewell
        (warning) =>
          warning.message &&
          warning.message.includes('Failed to parse source map') &&
          /node_modules\/@?jridgewell/.test(warning.module?.resource || ''),
        (warning) =>
          warning.message &&
          warning.message.includes('Failed to parse source map') &&
          /node_modules\/@babel\/generator/.test(warning.module?.resource || ''),
        // Ignorer les warnings liés aux binaires natifs de sharp
        (warning) =>
          warning.message &&
          (warning.message.includes('@img/sharp') || warning.message.includes('sharp-libvips')),
        (warning) =>
          warning.module?.resource &&
          warning.module.resource.includes('node_modules/sharp') &&
          warning.message.includes('Critical dependency'),
      ];

      const tsRule = webpackConfig.module.rules.find(
        (r) => r.oneOf
      );
      if (tsRule) {
        tsRule.oneOf.forEach((rule) => {
          if (rule.test && rule.test.toString().includes('tsx')) {
            rule.test = /\.(ts|tsx|js|jsx)$/;
          }
        });
      }

      webpackConfig.resolve = webpackConfig.resolve || {};
      webpackConfig.resolve.fallback = {
        ...(webpackConfig.resolve.fallback || {}),
        assert: false,
        buffer: false,
        child_process: false,
        crypto: false,
        dns: false,
        events: false,
        fs: false,
        http: false,
        https: false,
        net: false,
        os: false,
        path: false,
        stream: false,
        tls: false,
        url: false,
        util: false,
        zlib: false,
      };

      webpackConfig.resolve.alias = {
        ...(webpackConfig.resolve.alias || {}),
        '@': path.resolve(__dirname, 'src/'),
        'ioredis': path.resolve(__dirname, 'src/__mocks__/ioredis.js'),
        'redis': path.resolve(__dirname, 'src/__mocks__/redis.js'),
      };

      return webpackConfig;
    }
  }
};
