const { getErrorService } = require("../services/error-service");

/**
 * @description Reports an error from the renderer process.
 * @param {object} errorInfo - The error information.
 * @param {string} errorInfo.error - The error message.
 * @param {string} errorInfo.source - The source of the error.
 */
function reportError(error, source) {
    const errorService = getErrorService();
    errorService.reportError(new Error(error), source);
}

module.exports = { reportError };
