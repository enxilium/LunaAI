const { getEventsService } = require("../../services/events-service");

/**
 * Handles the end of a conversation, triggering cleanup and state reset.
 * @returns {Promise<Object>} - A success object.
 */
async function handleEnd() {
    console.log("Handling conversation end.");

    const eventsService = await getEventsService();
    eventsService.handleConversationEnd();

    return { success: true, message: "Conversation ended." };
}

module.exports = { handleEnd };

