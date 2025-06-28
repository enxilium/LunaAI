const { getNLGService } = require('../../services/nlg-service');
const { getErrorService } = require('../../services/error-service');
const { parseWeatherDatetime } = require('../../utils/datetime-parser');
const { 
    getCoordinates, 
    fetchWeatherData, 
    generateWeatherResponse, 
    getDefaultLocation 
} = require('../../utils/weather-utils');

/**
 * Fetches weather data based on the provided arguments
 * @param {Object} context_map - Arguments from wit.ai
 * @returns {Promise<Object>} - Weather data
 */
async function getWeather(context_map) {
    try {
        // Handle missing context_map
        if (!context_map) {
            context_map = {};
        }
        
        // Extract location from context map or use default
        let locationEntity;
        let location;
        
        if (!context_map.location || !context_map.location[0]) {
            // Use Toronto as default location
            locationEntity = getDefaultLocation();
            location = locationEntity.body;
            console.log(`No location provided, using default: ${location}`);
            
            // Add location to context_map for future reference
            context_map.location = [locationEntity];
        } else {
            locationEntity = context_map.location[0];
            location = locationEntity.body;
        }
        
        // Parse datetime from context map using the utility function
        const datetime = parseWeatherDatetime(context_map);
        
        console.log(`Getting weather for ${location} ${datetime.description}`);
        
        // Get coordinates from location entity
        const { lat, long } = getCoordinates(locationEntity);
        
        if (!lat || !long) {
            context_map.error = `I couldn't find the coordinates for ${location}.`;
            context_map.error_solution = `Sorry, I couldn't find the location "${location}". Please try with a different city or area name.`;
            return { context_map, stop: false };
        }
        
        // Fetch weather data from WeatherAPI
        const weatherData = await fetchWeatherData(lat, long, location);
        
        // Try to use NLG service for more natural response if available
        try {
            const nlgService = await getNLGService();
            
            // Get location name from API if available
            const locationName = weatherData.location && weatherData.location.name ? weatherData.location.name : location;
            
            // Prepare weather data for NLG
            const nlgWeatherData = {
                location: locationName,
                datetime: datetime,
                current: weatherData.current,
                forecast: weatherData.forecast.forecastday,
            };
            
            // Generate natural language response using NLG service
            const response = await nlgService.generateWeatherSummary(
                nlgWeatherData, 
                { 
                    timeFrame: datetime.description,
                    location: locationName 
                }
            );
            
            // Store response in context map
            context_map.weather = response;
            
        } catch (nlgError) {
            console.warn('NLG service unavailable, falling back to template-based response:', nlgError);
            
            // Fall back to the template-based response if NLG fails
            const response = generateWeatherResponse(weatherData, datetime, location);
            context_map.weather = response;
        }
        
        return { context_map, stop: false };
    } catch (error) {
        // Get the error service to report the error
        const errorService = getErrorService();
        errorService.reportError(error, 'weather-command');
        
        // Set error message and solution in context map
        context_map.error = error.message;
        context_map.error_solution = "I'm sorry, I had trouble getting the weather forecast. Please check your internet connection or try again later.";
        
        return { context_map, stop: false };
    }
}

module.exports = {
    getWeather
};

