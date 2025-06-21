const { Wit, log } = require("node-wit");
const { getDate, getTime, getWeather, checkCalendar, addCalendarEvent, handleError, handleEnd } = require("../commands");
const { v4: uuidv4 } = require("uuid");
const { getEventsService, EVENT_TYPES } = require("./events-service");

let witService = null;

class WitService {
    constructor() {
        this.actions = {
            getDate,
            getTime,
            getWeather,
            checkCalendar,
            addCalendarEvent,
            handleError,
            handleEnd
        };

        this.wit = null;
        this.contextMap = {};
        this.sessionId = uuidv4();
        this.currentConversation = null;

        this.eventsService = null;
    }

    resetConversation() {
        this.currentConversation = null;
        this.sessionId = uuidv4();
        this.contextMap = {};
    }

    async initialize() {
        const ACCESS_KEY = process.env.WIT_ACCESS_KEY;
        this.eventsService = await getEventsService();

        if (!ACCESS_KEY) {
            throw new Error("WIT_ACCESS_KEY environment variable not set");
        }

        this.wit = new Wit({
            accessToken: ACCESS_KEY,
            actions: this.actions,
        });

        this.wit.on("partialTranscription", (text) => {
            console.log("Partial:", text + "...");
        });

        this.wit.on("fullTranscription", (text) => {
            console.log("Full:", text + " (final)");
            this.eventsService.processingStarted()
        });

        this.wit.on("response", (data) => {
            console.log("Response from Wit:", data);
            
            if (data.speech) {
                this.synthesizeSpeech(data.speech.q);
            }
        });

        // Listen for reset conversation events
        this.eventsService.on(EVENT_TYPES.RESET_CONVERSATION, () => {
            this.resetConversation();
        });

        // Listen for error events
        this.eventsService.on(EVENT_TYPES.ERROR, (error) => {
            try {
                const result = handleError({error: error, context_map: this.contextMap});
                const solution = result && result.context_map && result.context_map.solution 
                    ? result.context_map.solution 
                    : "I'm sorry, an error occurred.";
                
                this.eventsService.showOrbWindow();
                this.synthesizeSpeech(solution);
                this.eventsService.sendToRenderer("error-handling");
            } catch (innerError) {
                console.error("Error in error handler:", innerError);
                this.synthesizeSpeech("I'm sorry, an unexpected error occurred. Please try again.");
            } finally {
                handleEnd(this.contextMap);
            }
        });

        console.log("Wit initialized.");
    }

    /**
     * Start a new conversation with an audio stream
     * @param {Readable} inputAudioStream - The audio input stream
     * @returns {Promise} Promise that resolves when conversation ends
     */
    async startConversation(inputAudioStream) {
        if (!inputAudioStream) {
            throw new Error("No audio stream provided");
        }

        if (!this.wit) {
            throw new Error("Wit.ai service not initialized");
        }

        try {
            console.log("Using old conversation", this.currentConversation != null);
            // Set correct content type for raw PCM audio
            const contentType =
                "audio/raw;encoding=signed-integer;bits=16;rate=16000;endian=little";

            this.currentConversation = this.wit.runComposerAudio(
                this.sessionId,
                contentType,
                inputAudioStream,
                this.contextMap
            );

            // Wait for the conversation to complete
            const result = await this.currentConversation;

            // Update context map
            if (result && result.context_map) {
                this.contextMap = result.context_map;
            }

            return result;
        } catch (error) {
            this.eventsService.reportError(error);
        }
    }

    async synthesizeSpeech(text) {
        try {
            const voice = "wit$Rosie"; // Default voice
            const style = "formal"; // Default style

            console.log(
                `Synthesizing speech: "${text}" with voice: ${voice}, style: ${style}`
            );

            const response = await this.wit.synthesize(
                text, // q - text to synthesize
                voice, // voice
                style, // style
            );

            return new Promise((resolve, reject) => {
                const chunks = [];
                let totalBytes = 0;

                // Stream audio chunks as they arrive
                response.body.on("data", (chunk) => {
                    chunks.push(chunk);
                    totalBytes += chunk.length;

                    this.eventsService.sendAudioChunk(chunk);
                });

                response.body.on("end", () => {
                    const audioBuffer = Buffer.concat(chunks);

                    // Signal end of streaming
                    this.eventsService.audioStreamComplete(totalBytes);

                    resolve(audioBuffer);
                });

                response.body.on("error", (error) => {
                    console.error("Stream error:", error);
                    reject(error);
                });
            });
        } catch (error) {
            console.error("Error in synthesizeSpeech:", error);
            throw error;
        }
    }
}

async function getWitService() {
    if (!witService) {
        try {
            witService = new WitService();
            await witService.initialize();
        } catch {
            throw new Error("Failed to initialize Wit service. Please check your WIT_ACCESS_KEY environment variable.");
        }
    }
    return witService;
}

module.exports = {
    getWitService
};
