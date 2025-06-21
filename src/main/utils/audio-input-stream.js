const { Readable } = require("stream");
const { getErrorService } = require("../services/error-service");

/**
 * Custom audio stream for Wit.ai
 * Using the implementation from the old-audio-service that worked correctly
 */
class AudioInputStream extends Readable {
    constructor(options = {}) {
        // Set highWaterMark to control backpressure - increase for better streaming
        super({
            ...options,
            highWaterMark: 32768, // 32KB chunks - larger buffer for smoother streaming
            objectMode: false, // Binary mode for audio data
        });
        this.ended = false;
        this.buffer = [];
        this.isReading = false;
        this.totalBytesRead = 0;
        this.totalBytesWritten = 0;
        
        // Debug counters
        this.chunkCount = 0;
    }

    _read(size) {
        // If we're already processing a read, wait
        if (this.isReading) return;

        this.isReading = true;

        try {
            // Process any buffered chunks
            while (this.buffer.length > 0) {
                const chunk = this.buffer.shift();
                // If push() returns false, stop reading
                const pushResult = this.push(chunk);
                this.totalBytesRead += chunk.length;

                if (!pushResult) {
                    this.isReading = false;
                    return;
                }
            }

            // No more buffered chunks, allow new writes
            this.isReading = false;

            // If ended and no more chunks, end the stream
            if (this.ended && this.buffer.length === 0) {
                this.push(null);
            }
        } catch (error) {
            this.isReading = false;
            const errorService = getErrorService();
            errorService.reportError(error, 'audio-input-stream._read');
        }
    }

    /**
     * Write audio data to the stream
     * @param {Buffer} chunk - Audio data chunk
     * @returns {Boolean} - Whether the write was successful
     */
    write(chunk) {
        if (this.ended) {
            return false;
        }

        try {
            if (!chunk || chunk.length === 0) {
                return true; // Return true to not indicate backpressure
            }

            // Ensure chunk is a Buffer
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            this.totalBytesWritten += buffer.length;
            this.chunkCount++;

            // If we're actively reading, push directly
            if (this.isReading) {
                const result = this.push(buffer);
                this.totalBytesRead += buffer.length;
                return result;
            }

            // Otherwise buffer the chunk
            this.buffer.push(buffer);

            // If buffer is getting too large, trigger a read
            if (this.buffer.length > 10) {
                setImmediate(() => this._read(buffer.length));
            }

            return true;
        } catch (error) {
            const errorService = getErrorService();
            errorService.reportError(error, 'audio-input-stream.write');
            return false;
        }
    }

    /**
     * End the stream
     */
    end() {
        if (!this.ended) {
            this.ended = true;
            console.log(`AudioInputStream ending: processed ${this.chunkCount} chunks, ${this.totalBytesWritten} bytes written`);

            // Process any remaining buffered chunks immediately
            if (this.buffer.length > 0) {
                // Create a copy of the buffer to avoid modification during iteration
                const remainingChunks = [...this.buffer];
                this.buffer = [];

                // Push all remaining chunks
                for (const chunk of remainingChunks) {
                    this.push(chunk);
                }

                // Give time for the chunks to be processed before sending end signal
                setImmediate(() => {
                    this.push(null);
                });
            } else {
                // No remaining chunks, can end immediately
                this.push(null);
            }
        }
    }
}

module.exports = AudioInputStream;