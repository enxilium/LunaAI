const { setOrbWindow } = require("../windows/orb-window");
const { useSpotifyService } = require("./spotify");
const { getWeather } = require("./weather");
const { getDate, getTime } = require("./date");
const { checkCalendar, addCalendarEvent } = require("./calendar");
const { handleError, handleEnd } = require("./misc")

async function handleCommand(commandCall) {
    let args = commandCall.args;
    const command = commandCall.name;

    let response = null;

    switch (command) {
        case "update-orb-size":
            setOrbWindow(args);
            break;
        default:
            console.error(`Unknown command: ${command}`);
            response = {
                type: "error-response",
                message: `Unknown command: ${command}`,
            };
    }

    return response;
}

module.exports = {
    handleCommand,
    getDate,
    getTime,
    getWeather,
    checkCalendar,
    addCalendarEvent,
    useSpotifyService,
    handleError,
    handleEnd,
};
