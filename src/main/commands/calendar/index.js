const { toTitleCase } = require("../../utils/string-formatting");
const { getErrorService } = require("../../services/error-service");

async function checkCalendar(context_map) {
    console.log("Checking calendar");
    return { context_map, stop: true };
}

async function addCalendarEvent(context_map) {
    try {
        const event_date = context_map.event_date;
        const date_utc = context_map.utc;
        const event_title = toTitleCase(context_map.event_title);

        console.log(`Adding calendar event: ${event_title} on ${event_date}`);
    } catch (error) {
        const errorService = getErrorService();
        errorService.reportError(error, 'calendar-command');
        context_map.error = error.message;

    } finally {
        return { context_map, stop: false };
    }
}

module.exports = {
    checkCalendar,
    addCalendarEvent,
};
