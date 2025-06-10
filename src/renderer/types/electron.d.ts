export {};

declare global {
    interface Window {
        electron: {
            send: (command: { name: string; args: any }) => void;
            receive: (
                channel: 'error-response' | 'transcription-result',
                func: (...args: any[]) => void
            ) => void;
            removeListener: (
                channel: 'error-response' | 'transcription-result'
            ) => void;
            invoke: (
                channel: 'get-picovoice-key' | 'get-settings' | 'get-listening-status' | 'authorize-service' | 'disconnect-service' | 'start-listening' | 'stop-listening' | 'transcribe-audio',
                ...args: any[]
            ) => Promise<any>;
            onAudioChunk: (
                callback: (chunkData: AudioChunkData) => void
            ) => void;
            onAudioStreamEnd: (
                callback: (streamInfo: StreamInfo) => void
            ) => void;
            removeAudioListeners: () => void;
        };
    }
}
