async function handleEnd() {
    const { getEventsService } = require("../services/events-service");
    const eventsService = await getEventsService();

    const result = await eventsService.handleConversationEnd();

    return result;
}

module.exports = {
    handleEnd,
};
