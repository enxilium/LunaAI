const keytar = require("keytar");
const Store = require("electron-store").default

const SERVICE_NAME = "Luna";

class DataStorage {
    constructor() {
        this.store = new Store({
            name: "luna-data-storage",
            encryptionKey: "luna-encryption-key",
            clearInvalidConfig: true,
        });
    }

    async setCredentials(key, value) {
        await keytar.setPassword(SERVICE_NAME, key, value);
    }

    async getCredentials(key) {
        const password = await keytar.getPassword(SERVICE_NAME, key);
        return password;
    }

    async deleteCredentials(key) {
        await keytar.deletePassword(SERVICE_NAME, key);
    }

    setConfig(key, value) {
        this.store.set(key, value);
    }

    getConfig(key) {
        return this.store.get(key);
    }

    deleteConfig(key) {
        this.store.delete(key);
    }
}

let userData = null;

function getUserData() {
    if (!userData) {
        userData = new DataStorage();
    }
    return userData;
}

module.exports = { getUserData };
