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
const { openApplication, openSpotify } = require("./open");
const { handleGeneralInquiry } = require("./general");
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
    openApplication,
    openSpotify,
    // General Inquiry
    handleGeneralInquiry,
    // Error handling
    handleError,
    handleEnd,
};
