const { EventEmitter } = require("events");

// Singleton instance
let errorService = null;

/**
 * @class ErrorService
 * @description A singleton service for centralized error reporting and handling.
 * @extends EventEmitter
 */
class ErrorService extends EventEmitter {
    /**
     * @description Creates an instance of ErrorService.
     */
    constructor() {
        super();

        // For debugging
        this.debugMode = process.env.NODE_ENV === "development";
    }

    /**
     * @description Report an error that will be emitted for central handling.
     * @param {Error|string} error - The error to report.
     * @param {string} [source='unknown'] - The source module reporting the error.
     */
    reportError(error, source = "unknown") {
        const errorMessage = error instanceof Error ? error.message : error;

        console.error(`[${source}] Error:`, errorMessage);

        // Emit the error event with source information
        this.emit("error", {
            error,
            source,
            timestamp: new Date(),
        });
    }
}

/**
 * @description Get the singleton error service instance.
 * @returns {ErrorService} The error service instance.
 */
function getErrorService() {
    if (!errorService) {
        errorService = new ErrorService();
    }
    return errorService;
}

module.exports = {
    getErrorService,
};
