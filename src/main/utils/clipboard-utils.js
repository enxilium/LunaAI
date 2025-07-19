const { clipboard } = require("electron");

/**
 * Set text content to clipboard
 * @param {string} text - Text to set to clipboard
 * @returns {Promise<void>}
 */
async function setClipboard(text) {
    clipboard.writeText(text);
}

/**
 * Get text content from clipboard
 * @returns {Promise<string>} Text from clipboard
 */
async function getClipboard() {
    return clipboard.readText();
}

module.exports = {
    setClipboard,
    getClipboard,
};
