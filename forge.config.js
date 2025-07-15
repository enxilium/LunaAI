const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = {
    packagerConfig: {
        asar: true,
        // The following properties are moved from package.json's build section
        appId: "com.luna.assistant",
        productName: "Luna AI Assistant",
    },
    rebuildConfig: {},
    makers: [
        {
            name: "@electron-forge/maker-squirrel",
            config: {},
        },
        {
            name: "@electron-forge/maker-zip",
            platforms: ["darwin"],
        },
        {
            name: "@electron-forge/maker-deb",
            config: {},
        },
        {
            name: "@electron-forge/maker-rpm",
            config: {},
        },
    ],
    plugins: [
        {
            name: "@electron-forge/plugin-webpack",
            config: {
                mainConfig: "./webpack.main.config.js",
                renderer: {
                    config: "./webpack.renderer.config.js",
                    entryPoints: [
                        {
                            html: "./src/renderer/main/index.html",
                            js: "./src/renderer/main/index.tsx",
                            name: "main_window",
                            preload: {
                                js: "./src/preload/preload.js",
                            },
                        },
                        {
                            html: "./src/renderer/orb/index.html",
                            js: "./src/renderer/orb/index.tsx",
                            name: "orb_window",
                            preload: {
                                js: "./src/preload/preload.js",
                            },
                        },
                    ],
                },
            },
        },
        {
            name: "@electron-forge/plugin-auto-unpack-natives",
            config: {},
        },
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
};
