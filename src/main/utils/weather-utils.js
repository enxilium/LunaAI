/**
 * Weather Utilities
 * Provides helper functions for weather-related operations
 */
const axios = require('axios');

/**
 * Get coordinates from location entity
 * @param {Object} locationEntity - Location entity from wit.ai
 * @returns {Object} - Coordinates {lat, long}
 */
function getCoordinates(locationEntity) {
    if (locationEntity.resolved && 
        locationEntity.resolved.values && 
        locationEntity.resolved.values.length > 0 &&
        locationEntity.resolved.values[0].coords) {
        return locationEntity.resolved.values[0].coords;
    }
    
    // Default coordinates if not found
    return { lat: null, long: null };
}

/**
 * Fetches weather data from WeatherAPI
 * @param {number} lat - Latitude
 * @param {number} long - Longitude
 * @param {string} location - Location name
 * @returns {Promise<Object>} - Weather data
 */
async function fetchWeatherData(lat, long, location) {
    try {
        // Check for API key
        if (!process.env.WEATHERAPI_KEY) {
            throw new Error('WeatherAPI key not set. Please set WEATHERAPI_KEY environment variable.');
        }
        
        const apiKey = process.env.WEATHERAPI_KEY;
        
        // Get current weather and forecast in a single call (3-day forecast included in free tier)
        // Increased to 7 days for better time range support if needed
        const weatherResponse = await axios.get(
            `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${long}&days=7&aqi=no&alerts=no`
        );
        
        return weatherResponse.data;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        throw new Error(`Failed to fetch weather data for ${location}`);
    }
}

/**
 * Generate natural language response for weather forecast
 * @param {Object} weatherData - Weather data from WeatherAPI
 * @param {Object} datetime - Parsed datetime information
 * @param {string} location - Location name
 * @returns {string} - Natural language response
 */
function generateWeatherResponse(weatherData, datetime, location) {
    // Handle missing data
    if (!weatherData || !weatherData.current || !weatherData.forecast) {
        return `I'm sorry, I couldn't get the weather forecast for ${location} ${datetime.description}.`;
    }
    
    const current = weatherData.current;
    const forecast = weatherData.forecast;
    const locationData = weatherData.location;
    
    // Use location name from API if available
    const locationName = locationData && locationData.name ? locationData.name : location;
    
    // Current weather
    if (datetime.type === 'current' || datetime.description === 'today') {
        const temp = Math.round(current.temp_c);
        const feelsLike = Math.round(current.feelslike_c);
        const condition = current.condition.text.toLowerCase();
        const humidity = current.humidity;
        const windSpeed = Math.round(current.wind_kph);
        
        // Get today's forecast for additional details
        const todayForecast = forecast.forecastday[0];
        const minTemp = Math.round(todayForecast.day.mintemp_c);
        const maxTemp = Math.round(todayForecast.day.maxtemp_c);
        
        // Get time-of-day forecasts
        const hourlyForecasts = todayForecast.hour;
        const morningForecast = hourlyForecasts[9]; // 9 AM
        const afternoonForecast = hourlyForecasts[15]; // 3 PM
        const eveningForecast = hourlyForecasts[19]; // 7 PM
        const nightForecast = hourlyForecasts[23]; // 11 PM
        
        const timeOfDayForecasts = `
Morning: ${Math.round(morningForecast.temp_c)}°C, ${morningForecast.condition.text.toLowerCase()}
Afternoon: ${Math.round(afternoonForecast.temp_c)}°C, ${afternoonForecast.condition.text.toLowerCase()}
Evening: ${Math.round(eveningForecast.temp_c)}°C, ${eveningForecast.condition.text.toLowerCase()}
Night: ${Math.round(nightForecast.temp_c)}°C, ${nightForecast.condition.text.toLowerCase()}`;
        
        return `The current weather in ${locationName} is ${condition} with a temperature of ${temp}°C (feels like ${feelsLike}°C). Today's forecast shows temperatures between ${minTemp}°C and ${maxTemp}°C with humidity at ${humidity}% and wind speeds of ${windSpeed} km/h.${timeOfDayForecasts}`;
    }
    
    // For future forecasts
    const forecastDays = forecast.forecastday;
    
    // Filter forecast data based on datetime
    let relevantForecasts = [];
    
    if (datetime.type === 'value') {
        // For a specific date
        const targetDate = datetime.value.toISOString().split('T')[0]; // YYYY-MM-DD format
        relevantForecasts = forecastDays.filter(day => day.date === targetDate);
        
        // If no exact match, find closest date
        if (relevantForecasts.length === 0) {
            const targetTime = datetime.value.getTime();
            relevantForecasts = [forecastDays.reduce((closest, day) => {
                const dayTime = new Date(day.date).getTime();
                const closestTime = new Date(closest.date).getTime();
                return Math.abs(dayTime - targetTime) < Math.abs(closestTime - targetTime) ? day : closest;
            }, forecastDays[0])];
        }
    } else if (datetime.type === 'interval') {
        // For a date range
        relevantForecasts = forecastDays.filter(day => {
            const dayDate = new Date(day.date);
            return dayDate >= datetime.from && dayDate <= datetime.to;
        });
    }
    
    // If no forecasts match or for any other case, use all available forecasts
    if (relevantForecasts.length === 0) {
        relevantForecasts = forecastDays;
    }
    
    // Single day forecast
    if (relevantForecasts.length === 1) {
        const day = relevantForecasts[0];
        const dayData = day.day;
        const condition = dayData.condition.text.toLowerCase();
        const minTemp = Math.round(dayData.mintemp_c);
        const maxTemp = Math.round(dayData.maxtemp_c);
        const chanceOfRain = dayData.daily_chance_of_rain;
        
        // Format the date in a readable format
        const forecastDate = new Date(day.date);
        const isToday = forecastDate.toDateString() === new Date().toDateString();
        const isTomorrow = new Date(forecastDate.getTime() + 86400000).toDateString() === new Date().toDateString();
        
        let dateText = isToday ? 'today' : isTomorrow ? 'tomorrow' : `on ${forecastDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
        
        // Get time-of-day forecasts
        const hourlyForecasts = day.hour;
        const morningForecast = hourlyForecasts[9]; // 9 AM
        const afternoonForecast = hourlyForecasts[15]; // 3 PM
        const eveningForecast = hourlyForecasts[19]; // 7 PM
        const nightForecast = hourlyForecasts[23]; // 11 PM
        
        const timeOfDayForecasts = `
Morning: ${Math.round(morningForecast.temp_c)}°C, ${morningForecast.condition.text.toLowerCase()}
Afternoon: ${Math.round(afternoonForecast.temp_c)}°C, ${afternoonForecast.condition.text.toLowerCase()}
Evening: ${Math.round(eveningForecast.temp_c)}°C, ${eveningForecast.condition.text.toLowerCase()}
Night: ${Math.round(nightForecast.temp_c)}°C, ${nightForecast.condition.text.toLowerCase()}`;
        
        return `The forecast for ${locationName} ${dateText} is ${condition} with temperatures between ${minTemp}°C and ${maxTemp}°C${chanceOfRain > 0 ? ` and a ${chanceOfRain}% chance of rain` : ''}.${timeOfDayForecasts}`;
    }
    
    // Multiple days forecast (for week or weekend)
    let forecastDetails = '';
    
    // Generate daily reports for each day in the range
    relevantForecasts.forEach(day => {
        const date = new Date(day.date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const condition = day.day.condition.text.toLowerCase();
        const minTemp = Math.round(day.day.mintemp_c);
        const maxTemp = Math.round(day.day.maxtemp_c);
        const chanceOfRain = day.day.daily_chance_of_rain;
        
        forecastDetails += `
${dayName}: ${condition}, ${minTemp}°C to ${maxTemp}°C${chanceOfRain > 0 ? `, ${chanceOfRain}% chance of rain` : ''}`;
    });
    
    // Get date range description
    let dateRangeText = datetime.description;
    if (!dateRangeText || dateRangeText === 'undefined') {
        const startDate = new Date(relevantForecasts[0].date);
        const endDate = new Date(relevantForecasts[relevantForecasts.length - 1].date);
        dateRangeText = `from ${startDate.toLocaleDateString('en-US', { weekday: 'long' })} to ${endDate.toLocaleDateString('en-US', { weekday: 'long' })}`;
    }
    
    // Calculate overall min/max and conditions
    const conditions = relevantForecasts.map(day => day.day.condition.text.toLowerCase());
    const uniqueConditions = [...new Set(conditions)];
    
    const minTemp = Math.min(...relevantForecasts.map(day => Math.round(day.day.mintemp_c)));
    const maxTemp = Math.max(...relevantForecasts.map(day => Math.round(day.day.maxtemp_c)));
    
    let conditionText = '';
    if (uniqueConditions.length === 1) {
        conditionText = uniqueConditions[0];
    } else if (uniqueConditions.length === 2) {
        conditionText = `${uniqueConditions[0]} changing to ${uniqueConditions[1]}`;
    } else {
        conditionText = 'varying conditions';
    }
    
    return `The forecast for ${locationName} ${dateRangeText} shows ${conditionText} with temperatures between ${minTemp}°C and ${maxTemp}°C.${forecastDetails}`;
}

/**
 * Get default location information for Toronto
 * @returns {Object} - Default location entity
 */
function getDefaultLocation() {
    return {
        body: "Toronto",
        resolved: {
            values: [
                {
                    coords: {
                        lat: 43.70642852783203,
                        long: -79.39864349365234
                    },
                    name: "Toronto",
                    timezone: "America/Toronto"
                }
            ]
        }
    };
}

module.exports = {
    getCoordinates,
    fetchWeatherData,
    generateWeatherResponse,
    getDefaultLocation
}; 