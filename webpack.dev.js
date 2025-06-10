const { merge } = require('webpack-merge');
const path = require('path');
const common = require('./webpack.common.js');

/**
 * Development-specific webpack configuration
 * Merged with common config to create the final development config
 */
module.exports = merge(common, {
  /**
   * Development mode
   * - Enables development-friendly defaults
   * - Less optimization for faster builds
   * - More detailed error messages and warnings
   */
  mode: "development",
  
  /**
   * Source map generation
   * - Creates source maps for debugging
   * - Development-only as it increases bundle size
   * - Allows debugging original source code instead of transpiled output
   */
  devtool: "source-map",
  
  /**
   * Development server configuration
   * - Only needed in development for local testing
   * - Provides live reloading and asset serving
   */
  devServer: {
    static: [
      {
        /**
         * Serve files from the dist directory
         * Development-only need to preview built output
         */
        directory: path.join(__dirname, "dist"),
      },
      {
        /**
         * Serve asset files during development
         * Development-specific path for accessing assets
         */
        directory: path.join(__dirname, "assets"),
        publicPath: '/assets'
      }
    ],
    port: 3000,
    /**
     * Enable hot module replacement
     * Development-only feature for faster feedback during coding
     */
    hot: true,
  },
  
  /**
   * Development-specific plugins
   */
  plugins: [],
}); 