const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
    /**
     * This is the main entry point for your application, it's the first file
     * that runs in the main process.
     */
    entry: "./src/main/main.js",
    // Put your normal webpack config below here
    module: {
        rules: require("./webpack.rules"),
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: "src/main/services/*.py",
                    to: "[name][ext]",
                },
                {
                    from: "src/main/services/agent/*.py",
                    to: "agent/[name][ext]",
                },
                {
                    from: "requirements.txt",
                    to: "requirements.txt",
                },
                {
                    from: ".env",
                    to: ".env",
                    noErrorOnMissing: true,
                },
            ],
        }),
    ],
    externals: {
        "@ffmpeg-installer/ffmpeg": "commonjs @ffmpeg-installer/ffmpeg",
        "fluent-ffmpeg": "commonjs fluent-ffmpeg",
        keytar: "commonjs keytar",
    },
    resolve: {
        extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".json"],
    },
};
