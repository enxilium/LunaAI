/**
 * Weather Utilities
 * Provides helper functions for weather-related operations
 */
const axios = require("axios");
const {
    parse,
    startOfWeek,
    endOfWeek,
    addDays,
    format,
    isWithinInterval,
    toDate,
} = require("date-fns");

/**
 * Get coordinates from a location string using WeatherAPI's search endpoint.
 * @param {string} location - Location string (e.g., "London", "New York, NY").
 * @param {string} apiKey - WeatherAPI API key
 * @returns {Promise<Object>} - Coordinates { lat, lon }
 */
async function getCoordinates(location, apiKey) {
    if (!apiKey) {
        throw new Error("WeatherAPI key not provided to getCoordinates.");
    }
    try {
        const response = await axios.get(
            `https://api.weatherapi.com/v1/search.json?key=${apiKey}&q=${location}`
        );
        if (response.data && response.data.length > 0) {
            // Return the coordinates of the first result
            const { lat, lon } = response.data[0];
            return { lat, lon };
        }
        return { lat: null, lon: null };
    } catch (error) {
        const { getErrorService } = require('../services/error-service');
        getErrorService().reportError(`Could not find coordinates for ${location}: ${error.message}`, "WeatherUtils");
        throw new Error(`Could not find coordinates for ${location}`);
    }
}

/**
 * Fetches weather data from WeatherAPI based on forecast type and timeframe.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} location - Location name for error messages.
 * @param {string} forecast_type - 'current', 'hourly', or 'daily'.
 * @param {string} [timeframe] - E.g., 'tomorrow', '2024-07-28'. Not used for 'current'.
 * @param {string} apiKey - WeatherAPI API key
 * @returns {Promise<Object>} - Formatted weather data.
 */
async function fetchWeatherData(
    lat,
    lon,
    location,
    forecast_type,
    timeframe,
    apiKey
) {
    if (!apiKey) {
        throw new Error("WeatherAPI key not provided to fetchWeatherData.");
    }

    try {
        if (forecast_type === "current") {
            const response = await axios.get(
                `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lon}`
            );
            return response.data;
        } else {
            const days = forecast_type === "daily" ? 10 : 3;
            const response = await axios.get(
                `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lon}&days=${days}`
            );

            if (!timeframe) {
                return response.data;
            }

            const forecastDays = response.data.forecast.forecastday;
            const targetDate = parseTimeframe(timeframe);

            if (forecast_type === "hourly" || forecast_type === "daily") {
                const relevantForecast = forecastDays.find(
                    (day) => day.date === format(targetDate, "yyyy-MM-dd")
                );
                if (relevantForecast) {
                    // For hourly, return the hours, for daily, return the day summary
                    return forecast_type === "hourly"
                        ? relevantForecast.hour
                        : relevantForecast.day;
                }
            }

            return response.data; // Fallback to full forecast
        }
    } catch (error) {
        const { getErrorService } = require('../services/error-service');
        getErrorService().reportError(`Failed to fetch weather data for ${location}: ${error.message}`, "WeatherUtils");
        throw new Error(`Failed to fetch weather data for ${location}`);
    }
}

/**
 * Parses a natural language timeframe into a Date object.
 * @param {string} timeframe - e.g., 'tomorrow', 'this weekend', '2024-07-28'.
 * @returns {Date} - The parsed date.
 */
function parseTimeframe(timeframe) {
    const now = new Date();
    const lowerTimeframe = timeframe.toLowerCase();

    if (lowerTimeframe.includes("tomorrow")) {
        return addDays(now, 1);
    }
    if (lowerTimeframe.includes("weekend")) {
        return startOfWeek(now, { weekStartsOn: 6 }); // Saturday
    }
    try {
        // Attempt to parse a specific date
        return parse(timeframe, "yyyy-MM-dd", new Date());
    } catch (e) {
        // Fallback to today if parsing fails
        return now;
    }
}

/**
 * Get default location information for Toronto
 * @returns {Object} - Default location entity
 */
function getDefaultLocation() {
    return "Toronto, ON";
}

module.exports = {
    getCoordinates,
    fetchWeatherData,
    getDefaultLocation,
};
