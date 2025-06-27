const { GoogleGenerativeAI } = require("@google/generative-ai");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { EventEmitter } = require("events");
const { getErrorService } = require("./error-service");
const { getEventsService, EVENT_TYPES } = require("./events-service");
const fs = require('fs/promises');

/**
 * Natural Language Generation Service
 * Uses Google's Gemini API via Langchain to generate natural language responses
 */
class NLGService extends EventEmitter {
    constructor() {
        super();
        this.initialized = false;
        this.errorService = null;
        this.geminiModel = null;
        this.outputParser = new StringOutputParser();
        
        // Default model to use
        this.modelName = "gemini-2.5-flash";
        
        // Debug mode for logging
        this.debugMode = process.env.NODE_ENV === "development";
        
        // Conversation history
        this.conversationHistory = [];
        
        // Maximum number of turns to keep in history (to prevent context window issues)
        this.maxHistoryTurns = 10;

        this.eventsService = null;
        this.errorService = null;
    }
    
    /**
     * Initialize the NLG service
     */
    async initialize() {
        try {
            // Check for API key
            if (!process.env.GEMINI_API_KEY) {
                throw new Error("Gemini API key not found. Please set GEMINI_API_KEY environment variable.");
            }
            
            // Initialize error service
            this.errorService = getErrorService();
            this.eventsService = await getEventsService();
            // Initialize Gemini client
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            
            // Initialize the model
            this.geminiModel = genAI.getGenerativeModel({ model: this.modelName });
            
            // Listen for reset conversation events
            this.setupEventListeners();
            
            this.initialized = true;
        } catch (error) {
            console.error("[NLGService] Initialization error:", error);
            if (this.errorService) {
                this.errorService.reportError(error, "nlg-service");
            }
            throw error;
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        try {
            // Listen for reset conversation events
            this.eventsService.on(EVENT_TYPES.RESET_CONVERSATION, () => {
                this.resetConversationHistory();
                console.log('[NLGService] Conversation history has been reset');
            });
        } catch (error) {
            console.error('[NLGService] Error setting up event listeners:', error);
        }
    }
    
    /**
     * Reset conversation history
     */
    resetConversationHistory() {
        this.conversationHistory = [];
    }
    
    /**
     * Add a message to conversation history
     * @param {string} role - The role (user or assistant)
     * @param {string} content - The message content
     */
    addToHistory(role, content) {
        this.conversationHistory.push({ role, content });
        
        // Trim history if it exceeds maximum length
        if (this.conversationHistory.length > this.maxHistoryTurns * 2) { // *2 because each turn has user and assistant messages
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryTurns * 2);
        }
        
        if (this.debugMode) {
            console.log(`[NLGService] Added ${role} message to history. History length: ${this.conversationHistory.length}`);
        }
    }
    
    /**
     * Generate a response to a general inquiry
     * @param {string} query - The user's query
     * @param {Object|string} context - Additional context for the query (text or image context)
     * @param {Object} systemContext - System context for personalization
     * @returns {Promise<string>} - Generated response
     */
    async generateResponse(query, context = null, systemContext = {}) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            const systemContextString = JSON.stringify(systemContext);
            
            // Base prompt parts
            const promptParts = [
                {
                    text: `
                    You are Luna, an intelligent Desktop AI assistant. 
                    Respond to the following query in a helpful, friendly, and concise manner. If needed, prompt the user for clarification or more information. Otherwise, ask if they have any other questions or requests.
                    
                    User Query: ${query}
                    
                    Preferences and system context: ${systemContextString}
                    
                    IMPORTANT FORMATTING INSTRUCTIONS:
                    1. Keep all sentences under 280 characters. This is critical for proper audio synthesis.
                    2. Use shorter sentences whenever possible.
                    3. Break up long explanations into multiple sentences.
                    4. Respond directly without mentioning that you're an AI or prefacing your response.
                    5. Never use sentences longer than 280 characters under any circumstances.
                    `
                }
            ];
            
            // Add conversation history if available
            if (this.conversationHistory.length > 0) {
                let historyText = "\nConversation history:\n";
                
                this.conversationHistory.forEach(msg => {
                    historyText += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
                });
                
                promptParts.push({
                    text: historyText
                });
            }
            
            // Handle different context types
            if (context) {
                if (typeof context === 'string') {
                    // Text context
                    promptParts.push({
                        text: `\nHere is the context for the prompt: \n${context}\n`
                    });
                } else if (context.type === 'image' && context.filePath) {
                    // Image context
                    try {
                        const imageData = await fs.readFile(context.filePath);
                        promptParts.push({
                            text: "\nHere is an image from the clipboard that I'd like you to analyze:"
                        });
                        promptParts.push({
                            inlineData: {
                                mimeType: context.mimeType || "image/png",
                                data: imageData.toString("base64")
                            }
                        });
                    } catch (imageError) {
                        console.error("[NLGService] Error reading image file:", imageError);
                        promptParts.push({
                            text: "\nNote: There was an error loading the image from clipboard."
                        });
                    }
                } else if (context.type === 'text') {
                    // Object with text content
                    promptParts.push({
                        text: `\nHere is additional context from the clipboard:\n${context.content}\n`
                    });
                }
            }
            
            // Generate response with context
            const result = await this.geminiModel.generateContent(promptParts);
            const response = result.response.text();
            
            // Add to conversation history
            this.addToHistory('user', query);
            this.addToHistory('assistant', response.trim());
            
            return response.trim();
        } catch (error) {
            console.error("[NLGService] Error generating response:", error);
            this.errorService.reportError(error, "nlg-service");
            return "I'm sorry, I encountered an error while processing your request.";
        }
    }
    
    /**
     * Generate a natural language summary of structured weather data
     * @param {Object} weatherData - Structured weather data
     * @param {Object} options - Options for generation
     * @returns {Promise<string>} - Natural language weather report
     */
    async generateWeatherSummary(weatherData, options = {}) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            const prompt = `
                You are a weather reporter providing a concise but informative weather forecast.
                Convert the following structured weather data into a conversational weather report.
                
                Weather Data: ${JSON.stringify(weatherData)}
                
                Time Frame: ${options.timeFrame || "today"}
                Location: ${options.location || "the area"}
                
                Guidelines:
                - Be concise but include all important information
                - For single-day forecasts: Include temperature range, conditions, and any notable weather events
                - For multi-day forecasts:
                  * Group similar days together (e.g., "Monday through Wednesday will be sunny")
                  * Highlight days with significant changes or extreme weather
                  * Always mention temperature ranges for each day or group of similar days
                - Use natural, conversational language
                - Include practical advice for extreme weather conditions
                - Use metric units (Celsius, km/h)
                - Keep paragraphs short (2-3 sentences each)
                
                CRITICAL SENTENCE LENGTH RULE:
                - EVERY sentence must be LESS THAN 280 characters
                - Break any longer thoughts into multiple shorter sentences
                - This is an absolute requirement for proper audio synthesis
                - Never exceed this limit for any sentence
                
                Respond with just the weather report, nothing else.
            `;
            
            const result = await this.geminiModel.generateContent(prompt);
            const response = result.response.text();
            
            return response.trim();
        } catch (error) {
            console.error("[NLGService] Error generating weather summary:", error);
            this.errorService.reportError(error, "nlg-service");
            return "I'm sorry, I couldn't generate a weather summary at this time.";
        }
    }
    
    /**
     * Generate a natural language summary from any structured data
     * @param {Object} data - Structured data to summarize
     * @param {Object} options - Options for generation
     * @returns {Promise<string>} - Natural language summary
     */
    async generateStructuredDataSummary(data, options = {}) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            const prompt = `
                Convert the following structured data into a natural language summary.
                
                Data: ${JSON.stringify(data)}
                
                Data Type: ${options.dataType || "general"}
                Tone: ${options.tone || "friendly"}
                
                Guidelines:
                - Be concise but informative
                - Use natural, conversational language
                - Highlight the most important information
                - Don't mention that you're converting data
                
                CRITICAL SENTENCE LENGTH RULE:
                - EVERY sentence must be LESS THAN 280 characters
                - Break any longer thoughts into multiple shorter sentences
                - This is an absolute requirement for proper audio synthesis
                - Never exceed this limit for any sentence
                
                Respond with just the summary, nothing else.
            `;
            
            const result = await this.geminiModel.generateContent(prompt);
            const response = result.response.text();
            
            return response.trim();
        } catch (error) {
            console.error("[NLGService] Error generating data summary:", error);
            this.errorService.reportError(error, "nlg-service");
            return "I'm sorry, I couldn't generate a summary at this time.";
        }
    }
}

// Singleton instance
let nlgService = null;

/**
 * Get the NLG service instance
 * @returns {Promise<NLGService>} The NLG service instance
 */
async function getNLGService() {
    if (!nlgService) {
        nlgService = new NLGService();
        await nlgService.initialize();
    }
    return nlgService;
}

module.exports = {
    getNLGService
};
