const { getMcpService } = require("../services/agent/mcp-service");

async function get_current_weather(location, unit = "metric") {
    const mcpService = await getMcpService();
    const weatherClient = mcpService.clients.get("weather");

    if (!weatherClient) {
        throw new Error("Weather MCP client not available.");
    }

    try {
        const result = await weatherClient.callTool("get_current_weather", {
            location,
            unit,
        });
        return result;
    } catch (error) {
        console.error("Error calling get_current_weather:", error);
        return `Error getting current weather: ${error.message}`;
    }
}

async function get_weather_forecast(location, unit = "metric") {
    const mcpService = await getMcpService();
    const weatherClient = mcpService.clients.get("weather");

    if (!weatherClient) {
        throw new Error("Weather MCP client not available.");
    }

    try {
        const result = await weatherClient.callTool("get_weather_forecast", {
            location,
            unit,
        });
        return result;
    } catch (error) {
        console.error("Error calling get_weather_forecast:", error);
        return `Error getting weather forecast: ${error.message}`;
    }
}

module.exports = {
    get_current_weather,
    get_weather_forecast,
};
