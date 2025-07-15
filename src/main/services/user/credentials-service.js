const keytar = require("keytar");

const SERVICE_NAME = "Luna";

/**
 * @class CredentialsService
 * @description A service for securely storing and retrieving credentials.
 */
class CredentialsService {
    /**
     * @description Set a credential in the system's keychain.
     * @param {string} key - The key to store the credential under.
     * @param {string} value - The credential to store.
     */
    async setCredentials(key, value) {
        await keytar.setPassword(SERVICE_NAME, key, value);
    }

    /**
     * @description Get a credential from the system's keychain.
     * @param {string} key - The key of the credential to retrieve.
     * @returns {Promise<string|null>} The retrieved credential, or null if it doesn't exist.
     */
    async getCredentials(key) {
        const password = await keytar.getPassword(SERVICE_NAME, key);
        return password;
    }

    /**
     * @description Delete a credential from the system's keychain.
     * @param {string} key - The key of the credential to delete.
     */
    async deleteCredentials(key) {
        await keytar.deletePassword(SERVICE_NAME, key);
    }

    /**
     * @description Check if a credential exists in the system's keychain.
     * @param {string} key - The key of the credential to check.
     * @returns {Promise<boolean>} True if the credential exists, false otherwise.
     */
    async credentialExists(key) {
        const password = await keytar.getPassword(SERVICE_NAME, key);
        return password !== null;
    }
}

let credentialsService = null;

/**
 * @description Get the singleton credentials service instance.
 * @returns {CredentialsService} The credentials service instance.
 */
function getCredentialsService() {
    if (!credentialsService) {
        credentialsService = new CredentialsService();
    }
    return credentialsService;
}

module.exports = { getCredentialsService };
