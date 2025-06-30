/**
 * Gets the current date information
 * @returns {Promise<string>} - Date information and generated response
 */
async function getDate() {
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
    return `Today is ${formattedDate}`;
}

/**
 * Gets the current time information
 * @returns {Promise<string>} - Time information and generated response
 */
async function getTime() {
    const now = new Date();
    
    // Format the time in a natural, conversational way
    const options = { 
        hour: 'numeric', 
        minute: 'numeric',
        hour12: true
    };

    const formattedTime = now.toLocaleTimeString('en-US', options);

    // Create a natural-sounding speech response
    return `The current time is ${formattedTime}`;
}

module.exports = {
    getDate,
    getTime
};
