const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

/**
 * Common webpack configuration shared between development and production
 */
module.exports = {
  /**
   * Entry point - the main file that initiates the application
   * Common to both environments as the application starting point doesn't change
   */
  entry: "./src/renderer/index.tsx",

  /**
   * Output configuration - defines where and how the bundled files are generated
   * Base output path is common, but filename might be different in production (with hashes)
   */
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "renderer.js",
  },

  /**
   * Resolve extensions - allows importing modules without specifying extensions
   * Common to both environments as import patterns are consistent
   */
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".jsx"],
  },

  /**
   * Module rules - define how different file types should be processed
   * Common to both as the basic transformation needs are the same, though
   * production may apply additional optimizations
   */
  module: {
    rules: [
      /**
       * JavaScript/TypeScript/React processing
       * Uses Babel to transform modern JS and React/TSX to browser-compatible code
       */
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              "@babel/preset-env",
              "@babel/preset-react",
              "@babel/preset-typescript",
            ],
          },
        },
      },
      /**
       * CSS processing
       * Transforms CSS into JS modules, applies PostCSS transformations
       */
      {
        test: /\.css$/,
        use: [
          "style-loader",  // Injects styles into the DOM
          "css-loader",    // Interprets @import and url() in CSS
          "postcss-loader", // Applies PostCSS transformations
        ],
      },
      /**
       * Image asset handling
       * Processes image files into assets with proper URLs
       */
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: "asset/resource",
      },
      /**
       * Custom file handling (Picovoice model files)
       * Processes special file types needed for voice recognition
       */
      {
        test: /\.(ppn|pv)$/i,
        type: "asset/resource",
      },
    ],
  },

  /**
   * Common plugins used in both environments
   */
  plugins: [
    /**
     * HTML generation
     * Creates an HTML file to serve the bundle with proper references
     * Common to both environments as we always need an HTML entry point
     */
    new HtmlWebpackPlugin({
      template: "./src/renderer/index.html",
    }),
    
    /**
     * Asset copying for both environments
     * Ensures assets are consistent in development and production
     */
    new CopyWebpackPlugin({
      patterns: [
        /**
         * Copy assets folder to dist/assets
         * Makes all assets available to the application
         */
        {
          from: "assets",
          to: "assets",
        },
      ],
    }),
  ],
}; 