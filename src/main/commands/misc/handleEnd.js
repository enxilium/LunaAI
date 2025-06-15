const { getMainWindow } = require("../../windows/main-window");
const { appEvents, EVENTS } = require("../../events");

async function handleEnd(context_map) {
    console.log("Handling conversation end.");

    let mainWindow = getMainWindow();
    
    // Emit an event instead of directly calling audio service
    appEvents.emit(EVENTS.STOP_LISTENING, { mainWindow });
    appEvents.emit(EVENTS.RESET_CONVERSATION);
    appEvents.emit(EVENTS.CONVERSATION_END);


    return { context_map, stop: true };
}

module.exports = { handleEnd };

