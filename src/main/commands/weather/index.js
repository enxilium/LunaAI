const { getErrorService } = require('../../services/error-service');
const { 
    getCoordinates, 
    fetchWeatherData,
    getDefaultLocation 
} = require('../../utils/weather-utils');

/**
 * Fetches weather data based on the provided arguments
 * @param {Object} args - Arguments from the tool call
 * @param {string} args.location - The location to get the weather for.
 * @returns {Promise<Object>} - Weather data
 */
async function getWeather({ location }) {
    try {
        let locationToSearch = location;

        // If no location is provided, use a default.
        if (!locationToSearch) {
            const defaultLocation = getDefaultLocation();
            locationToSearch = defaultLocation.body;
            console.log(`No location provided, using default: ${locationToSearch}`);
        }
        
        // The getCoordinates function expects an entity-like object.
        // We can create one on the fly.
        const locationEntity = { body: locationToSearch, value: locationToSearch };
        const { lat, long } = getCoordinates(locationEntity);
        
        if (!lat || !long) {
            throw new Error(`I couldn't find the coordinates for ${locationToSearch}.`);
        }
        
        // Fetch and return weather data directly
        const weatherData = await fetchWeatherData(lat, long, locationToSearch);
        return weatherData;

    } catch (error) {
        // Get the error service to report the error
        const errorService = getErrorService();
        errorService.reportError(error, 'weather-command');
        
        // Return an error object that can be sent back to the LLM
        return { 
            error: error.message,
            error_solution: "I'm sorry, I had trouble getting the weather forecast. Please try with a different city or area name."
        };
    }
}

module.exports = {
    getWeather
};

