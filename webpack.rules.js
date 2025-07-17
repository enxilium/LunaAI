module.exports = [
    // Add support for native node modules
    {
        test: /\.node$/,
        use: "native-ext-loader",
    },
    {
        test: /\.tsx?$/,
        exclude: /(node_modules|\.webpack)/,
        use: {
            loader: "babel-loader",
            options: {
                presets: [
                    ["@babel/preset-env", { targets: { node: "current" } }],
                    "@babel/preset-react",
                    "@babel/preset-typescript",
                ],
            },
        },
    },
    {
        test: /\.css$/,
        use: ["style-loader", "css-loader", "postcss-loader"],
    },
    {
        test: /\.(png|jpe?g|gif|svg)$/,
        type: "asset/resource",
    },
    {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: "asset/resource",
    },
    {
        test: /\.(pv|ppn)$/,
        type: "asset/resource",
    },
];
