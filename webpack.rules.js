module.exports = [
    // Add support for native node modules is not needed as of Electron Forge v6
    // Babel loader for JS, JSX, TS, TSX files
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
    // CSS loader
    {
        test: /\.css$/,
        use: ["style-loader", "css-loader", "postcss-loader"],
    },
    // Image assets
    {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: "asset/resource",
    },
    // Picovoice model files
    {
        test: /\.(ppn|pv)$/i,
        type: "asset/resource",
    },
    // Native node modules
    {
        test: /\.node$/,
        use: "native-ext-loader",
    },
];
