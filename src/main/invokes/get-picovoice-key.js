/**
 * Handles the get-picovoice-key invoke call
 * @returns {string} - Picovoice API key from environment
 */
async function getPicovoiceKey() {
    return process.env.PICOVOICE_ACCESS_KEY;
}

module.exports = { getPicovoiceKey }; 