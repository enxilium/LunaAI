const axios = require('axios');
const { getNLGService } = require('../../services/nlg-service');

/**
 * Parse datetime from context_map which can be in various formats
 * @param {Object} context_map - Context map from wit.ai
 * @returns {Object} - Parsed datetime information
 */
function parseDatetime(context_map) {
    // Handle missing context_map
    if (!context_map) {
        const now = new Date();
        return {
            type: 'current',
            value: now,
            description: 'today'
        };
    }

    if (!context_map.date || !context_map.date[0]) {
        // If no date is provided, default to current time
        const now = new Date();
        return {
            type: 'current',
            value: now,
            description: 'today'
        };
    }

    const dateEntity = context_map.date[0];
    
    // Case 1: Interval type (from-to)
    if (dateEntity.type === 'interval' && dateEntity.from && dateEntity.to) {
        const fromDate = new Date(dateEntity.from.value);
        const toDate = new Date(dateEntity.to.value);
        
        return {
            type: 'interval',
            from: fromDate,
            to: toDate,
            grain: dateEntity.from.grain || 'day',
            description: dateEntity.body || formatDateRangeDescription(fromDate, toDate)
        };
    }
    
    // Case 2: Value type with grain
    if ((dateEntity.type === 'value' || dateEntity.values) && 
        (dateEntity.grain || (dateEntity.values && dateEntity.values[0] && dateEntity.values[0].grain))) {
        
        const grain = dateEntity.grain || (dateEntity.values && dateEntity.values[0] && dateEntity.values[0].grain);
        const value = dateEntity.value || (dateEntity.values && dateEntity.values[0] && dateEntity.values[0].value);
        const date = new Date(value);
        
        return {
            type: 'value',
            value: date,
            grain: grain,
            description: dateEntity.body || formatDateDescription(date, grain)
        };
    }

    // Default case: use the raw value if available
    if (dateEntity.value) {
        const date = new Date(dateEntity.value);
        return {
            type: 'value',
            value: date,
            description: dateEntity.body || formatDateDescription(date, 'day')
        };
    }

    // Fallback to current time
    const now = new Date();
    return {
        type: 'current',
        value: now,
        description: 'today'
    };
}

/**
 * Format a date range description
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {string} - Natural language description
 */
function formatDateRangeDescription(fromDate, toDate) {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    
    // Check if dates are on the same day
    if (fromDate.toDateString() === toDate.toDateString()) {
        return `on ${fromDate.toLocaleDateString('en-US', options)}`;
    }
    
    // Check if it's this weekend
    const now = new Date();
    const friday = new Date(now);
    friday.setDate(now.getDate() + (5 - now.getDay()));
    const monday = new Date(friday);
    monday.setDate(friday.getDate() + 3);
    
    if (fromDate >= friday && toDate <= monday) {
        return 'this weekend';
    }
    
    // Check if it's next week
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + (8 - now.getDay()));
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    
    if (fromDate >= nextMonday && toDate <= nextSunday) {
        return 'next week';
    }
    
    // Default to date range
    return `from ${fromDate.toLocaleDateString('en-US', options)} to ${toDate.toLocaleDateString('en-US', options)}`;
}

/**
 * Format a single date description based on grain
 * @param {Date} date - The date
 * @param {string} grain - The grain (day, week, month, etc.)
 * @returns {string} - Natural language description
 */
function formatDateDescription(date, grain) {
    const now = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    
    // Check if it's today
    if (date.toDateString() === now.toDateString()) {
        return 'today';
    }
    
    // Check if it's tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) {
        return 'tomorrow';
    }
    
    // Handle different grains
    switch (grain) {
        case 'week':
            // Check if it's next week
            const nextMonday = new Date(now);
            nextMonday.setDate(now.getDate() + (8 - now.getDay()));
            const nextSunday = new Date(nextMonday);
            nextSunday.setDate(nextMonday.getDate() + 6);
            
            if (date >= nextMonday && date <= nextSunday) {
                return 'next week';
            }
            break;
            
        case 'weekend':
            // Check if it's this weekend
            const friday = new Date(now);
            friday.setDate(now.getDate() + (5 - now.getDay()));
            const monday = new Date(friday);
            monday.setDate(friday.getDate() + 3);
            
            if (date >= friday && date <= monday) {
                return 'this weekend';
            }
            break;
    }
    
    // Default to formatted date
    return `on ${date.toLocaleDateString('en-US', options)}`;
}

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
        
        // Parse datetime from context map (parseDatetime already handles missing date)
        const datetime = parseDatetime(context_map);
        
        console.log(`Getting weather for ${location} ${datetime.description}`);
        
        // Get coordinates from location entity
        const { lat, long } = getCoordinates(locationEntity);
        
        if (!lat || !long) {
            context_map.error = `I couldn't find the coordinates for ${location}.`;
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
        console.error('Error in getWeather:', error);
        context_map.error = `I'm sorry, I encountered an error while getting the weather forecast: ${error.message}`;
        return { context_map, stop: false };
    }
}

module.exports = {
    getWeather
};

