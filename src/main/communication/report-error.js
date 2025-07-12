const { getErrorService } = require("../services/error-service");

/**
 * @description Reports an error from the renderer process.
 * @param {string} error - The error message.
 * @param {string} source - The source of the error.
 */
function reportError({error, source}) {
    const errorService = getErrorService();
    errorService.reportError(error, source);
}

module.exports = { reportError };
