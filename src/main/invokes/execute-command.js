const commands = require("../commands");

/**
 * @description Execute a command in the main process.
 * @param {Object} commandInfo - The arguments for the command.
 * @param {string} commandInfo.name - The name of the command to execute.
 * @param {Object} commandInfo.args - The arguments to pass to the command.
 * @returns {Promise<any>} - The result of the command.
 */
async function executeCommand(commandInfo) {
    const { name, args } = commandInfo;
    console.log("Executing command:", name, args);

    if (commands[name]) {
        console.log("Command found:", commands[name]);
        return await commands[name](args);
    } else {
        const { getErrorService } = require("../services");
        const errorService = getErrorService();
        errorService.reportError(
            new Error(`Unknown command: ${name}`),
            "execute-command"
        );
        return { error: `Unknown command: ${name}` };
    }
}

module.exports = { executeCommand };
