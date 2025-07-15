import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
    {
        files: ["**/*.{js,mjs,cjs}"],
        plugins: { js },
        extends: ["js/recommended"],
    },
    { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
    {
        files: ["**/*.{js,mjs,cjs}"],
        languageOptions: {
            globals: {
                ...globals.node,
                // Electron Forge webpack globals
                MAIN_WINDOW_WEBPACK_ENTRY: "readonly",
                MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: "readonly",
                ORB_WINDOW_WEBPACK_ENTRY: "readonly",
                ORB_WINDOW_PRELOAD_WEBPACK_ENTRY: "readonly",
            },
        },
    },
]);
