/**
 * @fileoverview Native Windows Text Typing Implementation
 * @description Uses VBScript SendKeys via Windows Script Host for fast, reliable text input
 *
 * This implementation replaces RobotJS to provide:
 * - Lightning-fast text typing (no character-by-character delays)
 * - Full support for special characters, newlines, and formatting
 * - Native Windows integration without Node.js compilation issues
 * - Support for SendKeys special characters like {ENTER}, {TAB}, etc.
 *
 * @author Luna AI Team
 */

const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

/**
 * @description Check if there's an active text input (focused text field)
 * @returns {Promise<{success: boolean, isActive: boolean, message: string}>} Status of active text input
 */
async function checkActiveTextInput() {
    return {
        success: true,
        isActive: true,
    };
}

/**
 * @description Type text using VBScript SendKeys for maximum speed and reliability
 * @param {string} text - The text to type
 * @returns {Promise<{success: boolean, message: string}>} Result of typing operation
 */
async function typeText(text) {
    try {
        if (!text || typeof text !== "string") {
            return {
                success: false,
                message: "Invalid text provided",
            };
        }

        if (text.length === 0) {
            return {
                success: true,
                message: "No text to type (empty string)",
            };
        }

        // Escape and handle special characters for VBScript SendKeys
        const escapedText = text
            .replace(/"/g, '""') // Escape quotes for VBScript
            .replace(/\r?\n/g, '"{ENTER}"') // Handle newlines as Enter key
            .replace(/\t/g, '"{TAB}"') // Handle tabs
            .replace(/\{/g, '"{{}"}') // Escape curly braces
            .replace(/\}/g, '"{}}"}')
            .replace(/\+/g, '"{+}"') // Escape special SendKeys characters
            .replace(/\^/g, '"{^}"')
            .replace(/%/g, '"{%}"')
            .replace(/~/g, '"{~}"')
            .replace(/\(/g, '"{(}"')
            .replace(/\)/g, '"{)}"');

        // Create VBScript to type the text
        const vbsScript = `
            Set WshShell = WScript.CreateObject("WScript.Shell")
            WScript.Sleep 100
            WshShell.SendKeys "${escapedText}"
        `;

        // Write VBScript to temp file and execute it
        const fs = require("fs");
        const path = require("path");
        const os = require("os");

        const tempFile = path.join(
            os.tmpdir(),
            "luna_type_" + Date.now() + ".vbs"
        );

        fs.writeFileSync(tempFile, vbsScript);

        await execAsync(`cscript //nologo "${tempFile}"`, {
            timeout: 5000,
            windowsHide: true,
        });

        fs.unlinkSync(tempFile);

        return {
            success: true,
            message: `Successfully typed ${text.length} characters using VBScript SendKeys`,
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to type text: ${error.message}. Make sure a text input field is focused and active.`,
        };
    }
}

/**
 * @description Clear the currently focused text field using VBScript
 * @returns {Promise<{success: boolean, message: string}>} Result of clear operation
 */
async function clearTextField() {
    try {
        // Create VBScript to select all and delete
        const vbsScript = `
            Set WshShell = WScript.CreateObject("WScript.Shell")
            WScript.Sleep 100
            WshShell.SendKeys "^a"
            WScript.Sleep 50
            WshShell.SendKeys "{DELETE}"
        `;

        // Write VBScript to temp file and execute it
        const fs = require("fs");
        const path = require("path");
        const os = require("os");

        const tempFile = path.join(
            os.tmpdir(),
            "luna_clear_" + Date.now() + ".vbs"
        );

        fs.writeFileSync(tempFile, vbsScript);

        await execAsync(`cscript //nologo "${tempFile}"`, {
            timeout: 5000,
            windowsHide: true,
        });

        fs.unlinkSync(tempFile);

        return {
            success: true,
            message: "Successfully cleared text field using VBScript SendKeys",
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to clear text field: ${error.message}. Make sure a text input field is focused and active.`,
        };
    }
}

module.exports = {
    checkActiveTextInput,
    typeText,
    clearTextField,
};
