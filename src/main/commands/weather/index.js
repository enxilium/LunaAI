const { getErrorService } = require("../../services/error-service");
const {
    getCredentialsService,
} = require("../../services/user/credentials-service");
const {
    getCoordinates,
    fetchWeatherData,
    getDefaultLocation,
} = require("../../utils/weather-utils");

/**
 * Fetches weather data based on the provided arguments
 * @param {Object} args - Arguments from the tool call
 * @param {string} args.location - The location to get the weather for.
 * @param {string} [args.forecast_type='current'] - The type of forecast to get ('current', 'hourly', 'daily').
 * @param {string} [args.timeframe] - The specific timeframe for the forecast (e.g., 'tomorrow').
 * @returns {Promise<Object>} - Weather data
 */
async function getWeather({ location, forecast_type = "current", timeframe }) {
    try {
        const credentialsService = getCredentialsService();
        const apiKey = await credentialsService.getCredentials(
            "weather-api-key"
        );

        let locationToSearch = location;

        // If no location is provided, use a default.
        if (!locationToSearch) {
            locationToSearch = getDefaultLocation();
            console.log(
                `No location provided, using default: ${locationToSearch}`
            );
        }

        const { lat, lon } = await getCoordinates(locationToSearch, apiKey);

        if (!lat || !lon) {
            throw new Error(
                `I couldn't find the coordinates for ${locationToSearch}.`
            );
        }

        // Fetch and return weather data directly
        const weatherData = await fetchWeatherData(
            lat,
            lon,
            locationToSearch,
            forecast_type,
            timeframe,
            apiKey
        );
        return weatherData;
    } catch (error) {
        // Get the error service to report the error
        const errorService = getErrorService();
        errorService.reportError(error, "weather-command");

        // Return an error object that can be sent back to the LLM
        return {
            error: error.message,
            error_solution:
                "I'm sorry, I had trouble getting the weather forecast. Please try with a different city or area name.",
        };
    }
}

module.exports = {
    getWeather,
};
