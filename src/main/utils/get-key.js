/**
 * @description Get keys/credentials from the credentials service.
 * @param {string} keyName - The name of the key to retrieve.
 * @returns {Promise<string | null>} The requested credential/key.
 */
function getKey(keyName) {
    const {
        getCredentialsService,
    } = require("../services/user/credentials-service");
    const credentialsService = getCredentialsService();
    return credentialsService.getCredentials(`${keyName}-key`);
}

module.exports = {
    getKey,
}