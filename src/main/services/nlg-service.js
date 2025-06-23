const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { getErrorService } = require("./error-service");
const { EventEmitter } = require("events");

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
            
            // Initialize Gemini client
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            
            // Initialize the model
            this.geminiModel = genAI.getGenerativeModel({ model: this.modelName });
            
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
     * Generate a response to a general inquiry
     * @param {string} query - The user's query
     * @param {Object} context - Additional context for the query
     * @returns {Promise<string>} - Generated response
     */
    async generateResponse(query, context = {}) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            const contextString = JSON.stringify(context);
            const prompt = `
                You are Luna, an intelligent AI assistant. 
                Respond to the following query in a helpful, friendly, and concise manner.
                
                User Query: ${query}
                
                Additional Context: ${contextString}
                
                IMPORTANT FORMATTING INSTRUCTIONS:
                1. Keep all sentences under 280 characters. This is critical for proper audio synthesis.
                2. Use shorter sentences whenever possible.
                3. Break up long explanations into multiple sentences.
                4. Respond directly without mentioning that you're an AI or prefacing your response.
                5. Never use sentences longer than 280 characters under any circumstances.
            `;
            
            const result = await this.geminiModel.generateContent(prompt);
            const response = result.response.text();
            
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
