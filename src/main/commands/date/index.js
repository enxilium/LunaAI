/**
 * Gets the current date information
 * @param {Object} context_map - Arguments from wit.ai
 * @returns {Promise<Object>} - Date information and generated response
 */
async function getDate(context_map) {
    try {
        const date = new Date();
    
        // Format the date in a natural, conversational way
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        
        const formattedDate = date.toLocaleDateString('en-US', options);
        
        // Create a more natural-sounding speech response
        const speech = `Today is ${formattedDate}`;

        context_map.date = speech;
    } catch (error) {
        context_map.error = error.message;
        context_map.error_solution = "Sorry, an unexpected error occurred while getting the date."
    } finally {
        return { context_map, stop: false }
    }
}

/**
 * Gets the current time information
 * @param {Object} context_map - Arguments from wit.ai
 * @returns {Promise<Object>} - Time information and generated response
 */
async function getTime(context_map) {
    try {
        const now = new Date();
        
        // Format the time in a natural, conversational way
        const options = { 
            hour: 'numeric', 
            minute: 'numeric',
            hour12: true
        };

        const formattedTime = now.toLocaleTimeString('en-US', options);

        // Create a natural-sounding speech response
        const speech = `The current time is ${formattedTime}`;

        context_map.time = speech;

    } catch (error) {
        context_map.error = error.message;
        context_map.error_solution = "Sorry, an unexpected error occurred while getting the time."
    } finally {
        return { context_map, stop: false }
    }
}

module.exports = {
    getDate,
    getTime
};
