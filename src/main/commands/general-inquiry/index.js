const { getNLGService } = require('../../services/nlg-service');

/**
 * Handles general inquiries using the NLG service
 * @param {Object} context_map - Arguments from wit.ai
 * @returns {Promise<Object>} - Response data
 */
async function handleGeneralInquiry(context_map) {
    try {
        // Extract the query from context map
        const query = context_map.text || '';
        
        if (!query.trim()) {
            context_map.error = "I didn't receive a query to respond to.";
            return { context_map, stop: false };
        }
        
        console.log(`Processing general inquiry: "${query}"`);
        
        // Get NLG service
        const nlgService = await getNLGService();
        
        // Prepare context for the NLG service
        const nlgContext = {
            // Add any relevant context from context_map
            // For example, user preferences, previous conversation, etc.
        };
        
        // Generate response using NLG service
        const response = await nlgService.generateResponse(query, nlgContext);
        
        // Store response in context map
        context_map.response = response;
        
        return { context_map, stop: false };
    } catch (error) {
        console.error('Error in handleGeneralInquiry:', error);
        context_map.error = `I'm sorry, I encountered an error while processing your inquiry: ${error.message}`;
        return { context_map, stop: false };
    }
}

module.exports = {
    handleGeneralInquiry
}; 