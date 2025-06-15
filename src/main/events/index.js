const { EventEmitter } = require('events');

// Create a singleton event bus
class AppEvents extends EventEmitter {
  constructor() {
    super();
  }
}

// Export a singleton instance
const appEvents = new AppEvents();

module.exports = {
  appEvents,
  // Event constants
  EVENTS: {
    STOP_LISTENING: 'stop-listening',
    PROCESSING_REQUEST: 'processing-request',
    AUDIO_CHUNK: 'audio-chunk',
    AUDIO_STREAM_END: 'audio-stream-end',
    FULL_RESPONSE: 'full-response',
    ERROR: 'error',
    CONVERSATION_END: 'conversation-end',
    RESET_CONVERSATION: 'reset-conversation',
  }
}; 