const { getErrorService } = require("../error-service");
const Store = require("electron-store").default;

/**
 * @class SettingsService
 * @description A service for storing and retrieving user settings and preferences.
 */
class SettingsService {
    constructor() {
        this.store = new Store({
            name: "luna-settings-storage",
            encryptionKey: "luna-settings-encryption-key",
            clearInvalidConfig: true,
        });

        this.errorService = getErrorService();
    }

    /**
     * @description Set a configuration value.
     * @param {string} key - The key to store the configuration value under.
     * @param {any} value - The configuration value to store.
     */
    setConfig(key, value) {
        this.store.set(key, value);
    }

    /**
     * @description Get a configuration value.
     * @param {string} key - The key of the configuration value to retrieve.
     * @returns {any} The retrieved configuration value.
     */
    getConfig(key) {
        if (!key) {
            return this.store.store;
        }
        
        if (!this.store.has(key)) {
            this.errorService.reportError(
                new Error(`Getting nonexistent key: "${key}"`),
                "settingService"
            );

            return null;
        }

        return this.store.get(key);
    }

    /**
     * @description Delete a configuration value.
     * @param {string} key - The key of the configuration value to delete.
     */
    deleteConfig(key) {
        this.store.delete(key);
    }

    /**
     * @description Get all configuration values.
     * @returns {object} All configuration values.
     */
    getAllSettings() {
        return { ...this.store.store };
    }
}

let settingsService = null;

/**
 * @description Get the singleton settings service instance.
 * @returns {SettingsService} The settings service instance.
 */
function getSettingsService() {
    if (!settingsService) {
        settingsService = new SettingsService();
    }
    return settingsService;
}

module.exports = { getSettingsService };
