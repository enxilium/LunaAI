const { getMainWindow, createMainWindow } = require('./main-window');
const { getOrbWindow, setOrbWindow, createOrbWindow } = require('./orb-window');
const { getErrorService } = require('../services/error-service');

async function createWindows() {
    console.log('[Windows] Creating windows...');
    try {
        // Create all windows in parallel and wait for them to load
        const [mainWindow, orbWindow] = await Promise.all([
            createMainWindow(),
            createOrbWindow()
        ]);
        
        console.log('[Windows] All windows created');
        return { mainWindow, orbWindow };
    } catch (error) {
        const errorService = getErrorService();
        errorService.reportError(`Error creating windows: ${error.message}`, 'windows');
        throw error;
    }
}

module.exports = {
    createWindows,
    getMainWindow,
    getOrbWindow,
    setOrbWindow
};