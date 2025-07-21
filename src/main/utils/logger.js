const chalk = require("chalk");

// Force color support and set to basic level for Windows compatibility
process.env.FORCE_COLOR = "1";
chalk.level = 1;

/**
 * Enhanced logger with colors and timestamps for better debugging
 */
class Logger {
    constructor() {
        this.isEnabled = true;
    }

    /**
     * Get formatted timestamp
     */
    getTimestamp() {
        const now = new Date();
        const time = now.toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
        });
        return chalk.gray(`[${time}]`);
    }

    /**
     * Format component name with consistent styling
     */
    formatComponent(component) {
        return chalk.cyan(`[${component}]`);
    }

    /**
     * Info level logging - general information
     */
    info(component, message, ...args) {
        if (!this.isEnabled) return;
        console.log(
            this.getTimestamp(),
            this.formatComponent(component),
            chalk.blue("[INFO]"),
            message,
            ...args
        );
    }

    /**
     * Success level logging - operations completed successfully
     */
    success(component, message, ...args) {
        if (!this.isEnabled) return;
        console.log(
            this.getTimestamp(),
            this.formatComponent(component),
            chalk.green("[SUCCESS]"),
            chalk.green(message),
            ...args
        );
    }

    /**
     * Warning level logging - potential issues
     */
    warn(component, message, ...args) {
        if (!this.isEnabled) return;
        console.log(
            this.getTimestamp(),
            this.formatComponent(component),
            chalk.yellow("[WARN]"),
            chalk.yellow(message),
            ...args
        );
    }

    /**
     * Error level logging - errors and exceptions
     */
    error(component, message, ...args) {
        if (!this.isEnabled) return;
        let formattedMessage = message;
        if (typeof message === "object") {
            try {
                formattedMessage = JSON.stringify(message, null, 2);
            } catch (e) {
                formattedMessage = String(message);
            }
        }
        // Also stringify any object args
        const formattedArgs = args.map((arg) => {
            if (typeof arg === "object") {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return arg;
        });
        console.error(
            this.getTimestamp(),
            this.formatComponent(component),
            chalk.red("[ERROR]"),
            chalk.red(formattedMessage),
            ...formattedArgs
        );
    }

    /**
     * Debug level logging - detailed debugging information
     */
    debug(component, message, ...args) {
        if (!this.isEnabled) return;
        console.log(
            this.getTimestamp(),
            this.formatComponent(component),
            chalk.magenta("[DEBUG]"),
            chalk.gray(message),
            ...args
        );
    }

    /**
     * Network/Connection level logging
     */
    network(component, message, ...args) {
        if (!this.isEnabled) return;
        console.log(
            this.getTimestamp(),
            this.formatComponent(component),
            chalk.blue("[NETWORK]"),
            chalk.blue(message),
            ...args
        );
    }

    /**
     * Audio/Media level logging
     */
    audio(component, message, ...args) {
        if (!this.isEnabled) return;
        console.log(
            this.getTimestamp(),
            this.formatComponent(component),
            chalk.magenta("[AUDIO]"),
            chalk.magenta(message),
            ...args
        );
    }

    /**
     * Server/API level logging
     */
    server(component, message, ...args) {
        if (!this.isEnabled) return;
        console.log(
            this.getTimestamp(),
            this.formatComponent(component),
            chalk.yellow("[SERVER]"),
            chalk.yellow(message),
            ...args
        );
    }

    /**
     * Performance/Timing level logging
     */
    perf(component, message, duration, ...args) {
        if (!this.isEnabled) return;
        const timing =
            duration !== undefined ? chalk.cyan(`(${duration}ms)`) : "";
        console.log(
            this.getTimestamp(),
            this.formatComponent(component),
            chalk.cyan("[PERF]"),
            chalk.cyan(message),
            timing,
            ...args
        );
    }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;
