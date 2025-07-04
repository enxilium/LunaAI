/**
 * Gets the current date information
 * @param {Object} args - Arguments object
 * @param {string} [args.format] - Format type: 'short', 'long', 'iso', 'relative'
 * @returns {Promise<string>} - Date information and generated response
 */
async function getDate(args = {}) {
    const date = new Date();
    const { format = "long" } = args;

    switch (format) {
        case "short":
            return date.toLocaleDateString("en-US");
        case "iso":
            return date.toISOString().split("T")[0];
        case "relative":
            return "Today";
        case "long":
        default:
            // Format the date in a natural, conversational way
            const options = {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            };
            const formattedDate = date.toLocaleDateString("en-US", options);
            return `Today is ${formattedDate}`;
    }
}

/**
 * Gets the current time information
 * @param {Object} args - Arguments object
 * @param {string} [args.format] - Format type: 'short', 'long', 'iso', 'relative'
 * @returns {Promise<string>} - Time information and generated response
 */
async function getTime(args = {}) {
    const now = new Date();
    const { format = "long" } = args;

    switch (format) {
        case "short":
            return now.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
            });
        case "iso":
            return now.toISOString();
        case "relative":
            const hour = now.getHours();
            if (hour < 12) return "Morning";
            if (hour < 17) return "Afternoon";
            return "Evening";
        case "long":
        default:
            // Format the time in a natural, conversational way
            const options = {
                hour: "numeric",
                minute: "numeric",
                hour12: true,
            };
            const formattedTime = now.toLocaleTimeString("en-US", options);
            return `The current time is ${formattedTime}`;
    }
}

module.exports = {
    getDate,
    getTime,
};
