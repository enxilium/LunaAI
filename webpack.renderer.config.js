require("dotenv").config();
const rules = require("./webpack.rules");
const path = require("path");

module.exports = {
    // Put your normal webpack config below here
    module: {
        rules,
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js", ".jsx"],
        modules: [path.resolve(__dirname, "node_modules"), "node_modules"],
    },
};
