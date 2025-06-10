const { Wit, log } = require("node-wit");
const { getDate, getTime, getWeather, checkCalendar } = require("../commands");
const { v4: uuidv4 } = require("uuid");
const { EventEmitter } = require("events");

let witService = null;

class WitService extends EventEmitter {
    constructor() {
        super();
        this.actions = {
            getDate,
            getTime,
            getWeather,
            checkCalendar,
        };
        this.wit = null;
        this.contextMap = {};
        this.sessionId = uuidv4();
        this.currentConversation = null;
    }

    async initialize() {
        const ACCESS_KEY = process.env.WIT_ACCESS_KEY;
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
        });

        this.wit.on("response", (data) => {
            const text = data.speech.q;

            this.synthesizeSpeech(text);
        });

        console.log("WitService initialized");
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

        // End any existing conversation
        if (this.currentConversation) {
            this.currentConversation = null;
        }

        try {
            // Create a new session ID for this conversation
            this.sessionId = uuidv4();

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

            // Emit the full response
            this.emit("full-response", result);

            return result;
        } catch (error) {
            console.error("Wit.ai error:", error);
            this.emit("error", error);
            throw error;
        } finally {
            this.currentConversation = null;
        }
    }

    /**
     * Get the current conversation status
     * @returns {Boolean} Whether a conversation is active
     */
    isConversationActive() {
        return this.currentConversation !== null;
    }

    /**
     * Synthesize speech using Wit.ai built-in synthesize method with streaming
     * @param {string} text - Text to synthesize
     * @param {string} voice - Voice to use (e.g., 'wit$Rosie')
     * @param {string} style - Style to use (e.g., 'soft')
     * @returns {Promise<Buffer>} Complete audio buffer
     */
    async synthesizeSpeech(text) {
        try {
            const voice = "wit$Rosie"; // Default voice
            const style = "soft"; // Default style

            console.log(
                `Synthesizing speech: "${text}" with voice: ${voice}, style: ${style}`
            );

            const response = await this.wit.synthesize(
                text, // q - text to synthesize
                voice, // voice
                style, // style
            );

            try {
                return new Promise((resolve, reject) => {
                    const chunks = [];
                    let totalBytes = 0;

                    // Stream audio chunks as they arrive
                    response.body.on("data", (chunk) => {
                        chunks.push(chunk);
                        totalBytes += chunk.length;

                        // Emit streaming MP3 audio chunks for immediate playback
                        this.emit("audio-chunk", {
                            chunk: chunk,
                            isFinal: false,
                        });
                    });

                    response.body.on("end", () => {
                        const audioBuffer = Buffer.concat(chunks);

                        // Signal end of streaming
                        this.emit("audio-stream-end", {
                            totalBytes: totalBytes,
                            contentType: "audio/mpeg",
                            isMP3: true,
                        });

                        resolve(audioBuffer);
                    });

                    response.body.on("error", (error) => {
                        console.error("Stream error:", error);
                        this.emit("audio-stream-error", error);
                        reject(error);
                    });
                });
            } else {
                throw new Error("No audio stream in response");
            }
        } catch (error) {
            console.error("Error in synthesizeSpeech:", error);
            throw error;
        }
    }
}

async function getWitService() {
    if (!witService) {
        witService = new WitService();
        await witService.initialize();
    }
    return witService;
}

module.exports = getWitService;
