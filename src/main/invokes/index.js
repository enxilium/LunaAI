// Import all invoke handlers
const getSettings = require('./settings/get-settings');
const authorizeService = require('./settings/authorize-service');
const disconnectService = require('./settings/disconnect-service');
const getListeningStatus = require('./status/get-listening-status');
const getPicovoiceKey = require('./services/get-picovoice-key');
const startListening = require('./status/start-listening');
const hideOrb = require('./status/hide-orb');

/**
 * Central handler for all invoke requests from renderer process
 * @param {Object} request - The invoke request containing method name and arguments
 * @param {Object} context - Context containing any data needed by handlers
 * @returns {Promise<any>} - Result of the invoke call
 */
async function handleInvoke(request, context = {}) {
    const { name, args = [] } = request;
    const { listeningStatus } = context;

    // Route to appropriate handler based on invoke name
    switch (name) {
        case 'get-settings':
            return await getSettings(args[0]);
            
        case 'get-listening-status':
            return await getListeningStatus(listeningStatus);
            
        case 'authorize-service':
            return await authorizeService(args[0]);
        
        case 'disconnect-service':
            return await disconnectService(args[0]);
            
        case 'get-picovoice-key':
            return await getPicovoiceKey();
            
        case 'start-listening':
            return await startListening(context);

        case 'hide-orb':
            return await hideOrb();

        default:
            throw new Error(`Unknown invoke method: ${name}`);
    }
}

module.exports = handleInvoke; 