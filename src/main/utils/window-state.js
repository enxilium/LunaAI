/**
 * Shared window state management
 * Used to track timeouts and state between command handlers
 */

let hideOrbTimeout = null;

function clearHideTimeout() {
    if (hideOrbTimeout) {
        clearTimeout(hideOrbTimeout);
        hideOrbTimeout = null;
        return true;
    }
    return false;
}

function setHideTimeout(callback, delay) {
    clearHideTimeout();
    hideOrbTimeout = setTimeout(() => {
        callback();
        hideOrbTimeout = null;
    }, delay);
    return hideOrbTimeout;
}

module.exports = {
    clearHideTimeout,
    setHideTimeout,
};
