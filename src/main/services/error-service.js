/**
 * error-service.js
 * 
 * A centralized service for error reporting that doesn't create circular dependencies.
 * This service emits events that the main events service can subscribe to.
 */

const { EventEmitter } = require('events');

// Singleton instance
let errorService = null;

class ErrorService extends EventEmitter {
    constructor() {
        super();
        
        // For debugging
        this.debugMode = process.env.NODE_ENV === 'development';
    }
    
    /**
     * Report an error that will be emitted for central handling
     * @param {Error|string} error - The error to report
     * @param {string} source - The source module reporting the error
     */
    reportError(error, source = 'unknown') {
        const errorMessage = error instanceof Error ? error.message : error;
        
        if (this.debugMode) {
            console.error(`[${source}] Error:`, errorMessage);
        }
        
        // Emit the error event with source information
        this.emit('error', {
            error,
            source,
            timestamp: new Date()
        });
    }
}

/**
 * Get the singleton error service instance
 * @returns {ErrorService} The error service instance
 */
function getErrorService() {
    if (!errorService) {
        errorService = new ErrorService();
    }
    return errorService;
}

module.exports = {
    getErrorService
}; 