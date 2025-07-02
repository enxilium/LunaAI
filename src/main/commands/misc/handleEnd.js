/**
 * Handles the end of a conversation, triggering cleanup and state reset.
 * @returns {Promise<Object>} - A success object.
 */
async function handleEnd() {
    const { getEventsService } = require("../../services/events-service");
    const eventsService = await getEventsService();

    return await eventsService.handleConversationEnd();
}

module.exports = { handleEnd };

