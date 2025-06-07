module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main.js',
  // Put your normal webpack config below here
  module: {
    rules: require('./webpack.rules'),
  },
  // Don't bundle native Node.js modules and those that use native modules
  externals: {
    'whatsapp-web.js': 'commonjs whatsapp-web.js',
    'puppeteer': 'commonjs puppeteer',
    'qrcode-terminal': 'commonjs qrcode-terminal'
  }
};
