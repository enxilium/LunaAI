const { Wit, log } = require("node-wit");
const { 
    getDate, 
    getTime, 
    getWeather, 
    checkCalendar, 
    addCalendarEvent, 

    // Import individual Spotify commands with updated names
    skipTrack,
    playPreviousTrack,
    resumePlayback,
    shufflePlayback,
    pausePlayback,
    increaseVolume,
    decreaseVolume,
    playSong,

    // App opening commands
    openApplication,
    openSpotify,

    // General Inquiry
    handleGeneralInquiry,
    
    // Error handling
    handleError, 
    handleEnd,
} = require("../commands");
const { v4: uuidv4 } = require("uuid");
const { getEventsService, EVENT_TYPES } = require("./events-service");
const { getErrorService } = require("./error-service");

let witService = null;

class WitService {
    constructor() {
        this.actions = {
            // Date & time commands
            getDate,
            getTime,
            
            // Weather command
            getWeather,
            
            // Calendar commands
            checkCalendar,
            addCalendarEvent,
            
            // Spotify commands
            skipTrack,
            playPreviousTrack,
            resumePlayback,
            shufflePlayback,
            pausePlayback,
            increaseVolume,
            decreaseVolume,
            playSong,
            
            // App opening commands
            openApplication,
            openSpotify,

            // General Inquiry
            handleGeneralInquiry,
            
            // Error handling
            handleError,
            handleEnd
        };

        this.wit = null;
        this.contextMap = {};
        this.sessionId = uuidv4();
        this.currentConversation = null;

        this.eventsService = null;
        this.errorService = null;
    }

    resetConversation() {
        this.currentConversation = null;
        this.sessionId = uuidv4();
        
        // Clear the entire context map
        this.contextMap = {};
        
        console.log("Conversation reset, all context cleared");
    }

    async initialize() {
        const ACCESS_KEY = process.env.WIT_ACCESS_KEY;
        this.eventsService = await getEventsService();
        this.errorService = getErrorService();
        if (!ACCESS_KEY) {
            this.reportError(new Error("WIT_ACCESS_KEY environment variable not set"));
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

        console.log("Wit initialized.");
    }

    /**
     * Start a new conversation with an audio stream
     * @param {Readable} inputAudioStream - The audio input stream
     * @returns {Promise} Promise that resolves when conversation ends
     */
    async startConversation(inputAudioStream) {
        if (!inputAudioStream) {
            this.reportError(new Error("No audio stream provided"));
        }

        if (!this.wit) {
            this.reportError(new Error("Wit.ai service not initialized"));
        }

        try {
            // Check if we should reset the conversation
            // If this is a new query and not a continuation, reset the conversation
            if (!this.currentConversation) {
                console.log("Starting new conversation");
                this.resetConversation();
            } else {
                console.log("Continuing existing conversation");
            }
            
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
                // Store the new context map
                this.contextMap = result.context_map;
            }

            // After the conversation completes, set currentConversation to null
            // This ensures the next call to startConversation will be treated as a new conversation
            this.currentConversation = null;

            return result;
        } catch (error) {
            this.reportError(error);
        }
    }

    async synthesizeSpeech(text) {
        try {
            const voice = "wit$Rosie"; // Default voice
            const style = "formal"; // Default style
            const speed = 120;
            
            // Break text into chunks of no more than 280 characters
            const textChunks = this.breakTextIntoChunks(text, 280);
            
            console.log(`Synthesizing speech in ${textChunks.length} chunks`);
            
            let allChunks = [];
            let totalBytes = 0;
            
            // Process each chunk sequentially
            for (const chunk of textChunks) {
                console.log(`Synthesizing chunk: "${chunk}"`);
                
                const response = await this.wit.synthesize(
                    chunk, // q - text to synthesize
                    voice, // voice
                    style, // style
                    speed, // speed
                );
                
                // Process this chunk's audio
                const { audioChunks, bytes } = await new Promise((resolve, reject) => {
                    const chunks = [];
                    let chunkBytes = 0;
                    
                    // Stream audio chunks as they arrive
                    response.body.on("data", (audioChunk) => {
                        chunks.push(audioChunk);
                        chunkBytes += audioChunk.length;
                        
                        // Send each audio chunk to the renderer
                        this.eventsService.sendAudioChunk(audioChunk);
                    });
                    
                    response.body.on("end", () => {
                        resolve({ audioChunks: chunks, bytes: chunkBytes });
                    });
                    
                    response.body.on("error", (error) => {
                        console.error("Stream error:", error);
                        reject(error);
                    });
                });
                
                // Add this chunk's audio to our collection
                allChunks = [...allChunks, ...audioChunks];
                totalBytes += bytes;
            }
            
            // Combine all audio chunks
            const audioBuffer = Buffer.concat(allChunks);
            
            // Signal end of streaming
            this.eventsService.audioStreamComplete(totalBytes);
            
            return audioBuffer;
        } catch (error) {
            this.reportError(error);
        }
    }

    /**
     * Breaks text into chunks that don't exceed maxLength characters
     * No sentence will span across multiple chunks
     * @param {string} text - The text to break into chunks
     * @param {number} maxLength - Maximum length of each chunk
     * @returns {string[]} - Array of text chunks
     */
    breakTextIntoChunks(text, maxLength) {
        // If text is already short enough, return it as is
        if (text.length <= maxLength) {
            return [text];
        }
        
        const chunks = [];
        let remainingText = text;
        
        while (remainingText.length > 0) {
            // If remaining text fits in a chunk, add it and we're done
            if (remainingText.length <= maxLength) {
                chunks.push(remainingText);
                break;
            }
            
            // Find the last sentence boundary within maxLength
            let cutPoint = maxLength;
            
            // Look for sentence endings (., !, ?) followed by a space or end of text
            for (let i = maxLength; i >= 0; i--) {
                if (i < remainingText.length && 
                    (remainingText[i] === '.' || remainingText[i] === '!' || remainingText[i] === '?') &&
                    (i === remainingText.length - 1 || remainingText[i + 1] === ' ')) {
                    cutPoint = i + 1; // Include the punctuation
                    break;
                }
            }
            
            // If no sentence boundary found, look for the last space
            if (cutPoint === maxLength) {
                for (let i = maxLength; i >= 0; i--) {
                    if (remainingText[i] === ' ') {
                        cutPoint = i;
                        break;
                    }
                }
                
                // If no space found, just cut at maxLength
                if (cutPoint === maxLength) {
                    cutPoint = maxLength;
                }
            }
            
            // Add the chunk and update remaining text
            chunks.push(remainingText.substring(0, cutPoint).trim());
            remainingText = remainingText.substring(cutPoint).trim();
        }
        
        return chunks;
    }

    reportError(error) {
        this.errorService.reportError(error, 'wit-service');
    }
}

async function getWitService() {
    const errorService = getErrorService();
    if (!witService) {
        try {
            witService = new WitService();
            await witService.initialize();
        } catch {
            errorService.reportError(new Error("Failed to initialize Wit service. Please check your WIT_ACCESS_KEY environment variable."), 'wit-service');
        }
    }
    return witService;
}

module.exports = {
    getWitService
};
