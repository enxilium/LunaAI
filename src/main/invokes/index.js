const { authorizeService } = require('./authorize-service');
const { getSettings } = require('./get-settings');
const { disconnectService } = require('./disconnect-service');
const { updateSettings } = require('./update-settings');
const { getPicovoiceKey } = require('./get-picovoice-key');

module.exports = {
    authorizeService,
    getSettings,
    disconnectService,
    updateSettings,
    getPicovoiceKey
}