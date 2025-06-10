const { createMainWindow } = require('./main-window');
const { createOrbWindow } = require('./orb-window');

function createWindows() {
    createMainWindow();
    createOrbWindow();
}

module.exports = {
    createWindows,
};