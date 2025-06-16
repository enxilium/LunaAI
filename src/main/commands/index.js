const { useSpotifyService } = require("./spotify");
const { getWeather } = require("./weather");
const { getDate, getTime } = require("./date");
const { checkCalendar, addCalendarEvent } = require("./calendar");
const { handleError, handleEnd } = require("./misc");

module.exports = {
    getDate,
    getTime,
    getWeather,
    checkCalendar,
    addCalendarEvent,
    useSpotifyService,
    handleError,
    handleEnd,
};
