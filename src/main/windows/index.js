const { getMainWindow, createMainWindow } = require('./main-window');
const { getOrbWindow, setOrbWindow, createOrbWindow } = require('./orb-window');
const { getErrorService } = require('../services/error-service');

async function createWindows() {
    console.log('Creating windows...');
    try {
        // Create all windows in parallel and wait for them to load
        const [mainWindow, orbWindow] = await Promise.all([
            createMainWindow(),
            createOrbWindow()
        ]);
        
        console.log('All windows created and loaded successfully');
        return { mainWindow, orbWindow };
    } catch (error) {
        const errorService = getErrorService();
        errorService.reportError(error, 'windows-index');
        throw error;
    }
}

module.exports = {
    createWindows,
    getMainWindow,
    getOrbWindow,
    setOrbWindow
};