const { getMainWindow } = require("../../windows/main-window");
const { getEventsService } = require("../../services/events-service");

async function handleEnd(context_map) {
    console.log("Handling conversation end.");

    const eventsService = await getEventsService();
    
    eventsService.handleConversationEnd();

    return { context_map, stop: true };
}

module.exports = { handleEnd };

