const { getNLGService } = require('../../services/nlg-service');
const { getClipboardContent, cleanupTempClipboardFile } = require('../../utils/clipboard-utils');

/**
 * Handles general inquiries using the NLG service
 * @param {Object} context_map - Arguments from wit.ai
 * @returns {Promise<Object>} - Response data
 */
async function handleGeneralInquiry(context_map) {
    try {
        // Extract the query from context map
        const query = context_map.query || '';
        
        if (!query.trim()) {
            context_map.error = "I didn't receive a query to respond to.";
            return { context_map, stop: false };
        }
        
        console.log(`Processing general inquiry: "${query}"`);
        
        // Get NLG service
        const nlgService = await getNLGService();
        
        // Prepare context for the NLG service
        const systemContext = {
            // TODO: System context, user preferences retrieved from database?
        };

        let clipboardContext = null;
        let tempFilePath = null;

        // Get clipboard content if context is attached
        if (context_map.context_attached) {
            try {
                console.log('Retrieving clipboard content...');
                clipboardContext = await getClipboardContent();
                
                if (clipboardContext.type === 'image') {
                    tempFilePath = clipboardContext.filePath;
                    console.log('Image found in clipboard, saved to:', tempFilePath);
                } else if (clipboardContext.type === 'text') {
                    console.log('Text found in clipboard:', clipboardContext.content.substring(0, 50) + '...');
                } else if (clipboardContext.type === 'empty') {
                    console.log('Clipboard is empty');
                    clipboardContext = null;
                }
            } catch (clipboardError) {
                console.error('Error getting clipboard content:', clipboardError);
                clipboardContext = null;
            }
        }
        
        // Generate response using NLG service
        const response = await nlgService.generateResponse(query, clipboardContext, systemContext);
        
        // Cleanup temporary files if any
        if (tempFilePath) {
            await cleanupTempClipboardFile(tempFilePath);
        }
        
        // Store response in context map
        context_map.answer = response;
        
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