const { getDate, getTime } = require("./getDateTime");
const { openApplication } = require("./openApplications");
const { downloadFile } = require("./downloadFile");
const { handleEnd } = require("./handleEnd");

module.exports = {
    getDate,
    getTime,
    openApplication,
    downloadFile,
    handleEnd,
};
