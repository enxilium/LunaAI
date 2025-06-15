const { toTitleCase } = require("../../utils/string-formatting");

async function checkCalendar(context_map) {
    console.log("Checking calendar");
    return { context_map, stop: true };
}

async function addCalendarEvent(context_map) {
    try {
        // Do some stuff - without NLG
        const event_date = context_map.event_date[0].body;
        const event_title = toTitleCase(context_map.event_title[0].body);

        console.log(`Adding calendar event: ${event_title} on ${event_date}`);
        context_map.success = true;

    } catch (error) {
        console.error("Error in addCalendarEvent:", error);
        context_map.success = false;
        context_map.error = error.message;

    } finally {
        return { context_map, stop: false };
    }
}

module.exports = {
    checkCalendar,
    addCalendarEvent,
};
