/**
 * @description Converts a string to title case.
 * @param {string} str - The string to convert.
 * @returns {string} The converted string in title case.
 */
function toTitleCase(str) {
    return str.replace(
        /\w\S*/g,
        (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
}

module.exports = {
    toTitleCase,
};
