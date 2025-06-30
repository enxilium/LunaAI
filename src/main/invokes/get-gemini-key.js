/**
 * Handles the get-gemini-key invoke call
 * @returns {string} - Gemini API key from environment
 */
async function getGeminiKey() {
    return process.env.GEMINI_API_KEY;
}

module.exports = { getGeminiKey };
