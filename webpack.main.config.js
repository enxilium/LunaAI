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
    externals: {
        "@ffmpeg-installer/ffmpeg": "commonjs @ffmpeg-installer/ffmpeg",
        "fluent-ffmpeg": "commonjs fluent-ffmpeg",
        keytar: "commonjs keytar",
    },
    resolve: {
        extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".json"],
    },
};
