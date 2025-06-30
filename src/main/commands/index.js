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
const { handleEnd } = require("./misc");
const { openApplication, openSpotify } = require("./open");
const { 
    checkEmails,
    draftEmail,
    getCalendarEvents,
    createCalendarEvent,
    listDriveFiles
} = require("./google");

module.exports = {
    getDate,
    getTime,
    getWeather,
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
    // Google commands
    checkEmails,
    draftEmail,
    getCalendarEvents,
    createCalendarEvent,
    listDriveFiles,
    // Error handling
    handleEnd,
};
