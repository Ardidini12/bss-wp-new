const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.resolve(__dirname, 'src/assets/Logo-BSS'), // No extension needed, Electron will use the right one per platform
    extraResource: [
      // Include necessary resources for WhatsApp Web.js
      './node_modules/puppeteer/.local-chromium'
    ]
  },
  rebuildConfig: {
    // Native module rebuild configuration
    forceRebuild: true,
    onlyModules: ['puppeteer', 'whatsapp-web.js']
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        iconUrl: path.resolve(__dirname, 'src/assets/Logo-BSS.webp'),
        setupIcon: path.resolve(__dirname, 'src/assets/Logo-BSS.webp'),
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: path.resolve(__dirname, 'src/assets/Logo-BSS.webp'),
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: path.resolve(__dirname, 'src/assets/Logo-BSS.webp'),
        },
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/index.html',
              js: './src/renderer.js',
              name: 'main_window',
              preload: {
                js: './src/preload.js',
              },
            },
          ],
        },
        // Disable Content Security Policy completely
        devContentSecurityPolicy: ""
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
