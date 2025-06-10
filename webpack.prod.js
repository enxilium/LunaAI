const { merge } = require("webpack-merge");
const TerserPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const common = require("./webpack.common.js");

/**
 * Production-specific webpack configuration
 * Merged with common config to create the final production build config
 */
module.exports = merge(common, {
  /**
   * Production mode
   * - Enables aggressive optimizations by default
   * - Minimizes bundle size
   * - Removes development-only code
   */
  mode: "production",

  /**
   * No source maps in production
   * - Reduces file size
   * - Prevents exposing source code to end users
   */
  devtool: false,

  /**
   * Output configuration specific to production
   * - Using content hash for better caching in production
   */
  output: {
    /**
     * Add content hash to filename for cache busting
     * Only in production as it complicates development
     */
    filename: "renderer.[contenthash].js",
  },

  /**
   * Production optimization settings
   * - Only needed in production to minimize file sizes
   * - Would slow down development builds unnecessarily
   */
  optimization: {
    minimize: true,
    minimizer: [
      /**
       * JavaScript minification
       * - Compresses and mangles JS code
       * - Production-only as it increases build time
       */
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true, // Removes console.* calls
          },
        },
      }),
      /**
       * CSS minification
       * - Optimizes and minifies CSS
       * - Production-only optimization
       */
      new CssMinimizerPlugin(),
    ],
    /**
     * Code splitting configuration
     * - Separates vendor code from application code
     * - Improves caching and loading efficiency
     */
    splitChunks: {
      chunks: "all",
      name: "vendor",
    },
  },

  /**
   * Production-specific plugins
   */
  plugins: [],
});
