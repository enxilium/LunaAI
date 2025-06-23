const { 
    skipTrack,
    playPreviousTrack,
    resumePlayback,
    shufflePlayback,
    pausePlayback,
    increaseVolume,
    decreaseVolume,
    playSong
} = require("./spotify");
const { getWeather } = require("./weather");
const { getDate, getTime } = require("./date");
const { checkCalendar, addCalendarEvent } = require("./calendar");
const { handleError, handleEnd } = require("./misc");
const { open, openSpotify } = require("./open");

module.exports = {
    getDate,
    getTime,
    getWeather,
    checkCalendar,
    addCalendarEvent,
    // Spotify commands
    skipTrack,
    playPreviousTrack,
    resumePlayback,
    shufflePlayback,
    pausePlayback,
    increaseVolume,
    decreaseVolume,
    playSong,
    // App opening commands
    open,
    openSpotify,
    // Error handling
    handleError,
    handleEnd,
};
