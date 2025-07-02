const {
    skipTrack,
    playPreviousTrack,
    resumePlayback,
    shufflePlayback,
    pausePlayback,
    increaseVolume,
    decreaseVolume,
    playSong,
    addSongToQueue,
} = require("./spotify");

const { getWeather } = require("./weather");
const { getDate, getTime } = require("./date");
const { openApplication, openSpotify } = require("./open");
const downloadFile = require("./downloadFile");
const { authorizeService } = require("../invokes/authorize-service");

const {
    checkEmails,
    draftEmail,
    getCalendarEvents,
    createCalendarEvent,
    listDriveFiles,
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
    addSongToQueue,
    // App opening commands
    openApplication,
    openSpotify,
    // Google commands
    checkEmails,
    draftEmail,
    getCalendarEvents,
    createCalendarEvent,
    listDriveFiles,
    // File handling
    downloadFile,
    // Authorization
    authorizeService,
};
