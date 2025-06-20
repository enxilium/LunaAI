const { getUserData } = require('../services/credentials-service');

async function updateSettings(setting, value) {
    console.log(`Updating setting: ${setting} to value: ${value}`);

    userData = getUserData();
    userData.setConfig(setting, value);
}

module.exports = { updateSettings }