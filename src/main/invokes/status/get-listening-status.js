// This requires access to the global listeningStatus variable
// We'll pass this in from main.js

/**
 * Handles the get-listening-status invoke call
 * @param {Object} listeningStatus - Current listening status from main
 * @returns {Object} - Current listening status
 */
async function getListeningStatus(listeningStatus) {
    return listeningStatus;
}

module.exports = getListeningStatus; 