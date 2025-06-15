const { getOrbWindow } = require("../../windows/orb-window");

/**
 * Handles stopping the listening process
 * @param {Object} context - Application context
 * @returns {Object} - Updated listening status
 */
async function hideOrb() {
    // Update the global status through the context reference
    const orbWindow = getOrbWindow();

    setTimeout(() => {
        console.log("Hiding orb window");
        orbWindow.hide();
    }, 1000); // 1 second delay to match fade-out animation
    
    return;
}

module.exports = hideOrb; 