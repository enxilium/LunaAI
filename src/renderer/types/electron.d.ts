export {};

declare global {
    interface Window {
        electron: {
            send: (command: { name: string; args: any }) => void;
            receive: (
                channel: 'error-response' | 'stop-listening' | 'processing' | 'conversation-end' | 'start-listening',
                func: (...args: any[]) => void
            ) => void;
            removeListener: (
                channel: string,
            ) => void;
            invoke: (
                channel: 'get-picovoice-key' | 'get-settings' | 'get-listening-status' | 'authorize-service' | 'disconnect-service' | 'start-listening' | 'hide-orb' | 'transcribe-audio',
                ...args: any[]
            ) => Promise<any>;
            setupAudioListeners: () => void;
            onAudioChunk: (
                callback: (chunkData: AudioChunkData) => void
            ) => void;
            onAudioStreamEnd: (
                callback: (streamInfo: StreamInfo) => void
            ) => void;
            onConversationEnd: (
                callback: () => void
            ) => void;
        };
    }
}
