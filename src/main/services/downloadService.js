// TODO: Implement the downloadService
// This service will handle the logic of downloading a file from a URL.
// It should use Electron's session.downloadURL() API.
// It needs to be able to report progress back to the command.

function download(webContents, url, fileName) {
    // TODO: Use session.defaultSession.downloadURL(url)
    // TODO: Set the save path using the fileName
    // TODO: Listen for the 'updated' event to report progress
    // TODO: Listen for the 'done' event to report completion or failure
}

module.exports = { download };
