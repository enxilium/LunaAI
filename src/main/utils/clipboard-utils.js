/**
 * Clipboard utilities for Luna AI
 * Handles reading text and images from the clipboard
 */

const { clipboard } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

/**
 * Get content from clipboard, supporting both text and image formats
 * @returns {Promise<{type: string, content: string|Buffer, mimeType?: string, filePath?: string}>} 
 * Object containing clipboard content details
 */
async function getClipboardContent() {
    try {
        // Check if clipboard has an image
        const formats = clipboard.availableFormats();
        const hasImage = formats.some(format => format.startsWith('image/'));
        
        if (hasImage) {
            // Get image from clipboard
            const image = clipboard.readImage();
            
            if (image.isEmpty()) {
                throw new Error('Clipboard image is empty');
            }
            
            // Convert NativeImage to Buffer
            const pngBuffer = image.toPNG();
            
            // Save to temp file for API usage
            const tempDir = os.tmpdir();
            const fileName = `luna-clipboard-${uuidv4()}.png`;
            const filePath = path.join(tempDir, fileName);
            
            await fs.writeFile(filePath, pngBuffer);
            
            return {
                type: 'image',
                content: pngBuffer,
                mimeType: 'image/png',
                filePath
            };
        } else {
            // Try to get text from clipboard
            const text = clipboard.readText();
            
            if (text && text.trim()) {
                return {
                    type: 'text',
                    content: text
                };
            }
        }
        
        // No usable content found
        return {
            type: 'empty',
            content: ''
        };
    } catch (error) {
        console.error('Error reading clipboard:', error);
        return {
            type: 'error',
            content: `Error reading clipboard: ${error.message}`
        };
    }
}

/**
 * Cleanup temporary files created for clipboard images
 * @param {string} filePath - Path to the temporary file
 */
async function cleanupTempClipboardFile(filePath) {
    try {
        if (filePath) {
            await fs.unlink(filePath);
            console.log(`Cleaned up temporary clipboard file: ${filePath}`);
        }
    } catch (error) {
        console.error('Error cleaning up clipboard temp file:', error);
    }
}

module.exports = {
    getClipboardContent,
    cleanupTempClipboardFile
}; 