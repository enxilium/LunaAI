require("dotenv").config();
const rules = require("./webpack.rules");
const path = require("path");
const webpack = require("webpack");

module.exports = {
    // Put your normal webpack config below here
    module: {
        rules,
    },
    plugins: [
        new webpack.DefinePlugin({
            "process.env.PICOVOICE_ACCESS_KEY": JSON.stringify(
                process.env.PICOVOICE_ACCESS_KEY
            ),
        }),
    ],
    resolve: {
        extensions: [".tsx", ".ts", ".js", ".jsx"],
        modules: [path.resolve(__dirname, "node_modules"), "node_modules"],
    },
};
