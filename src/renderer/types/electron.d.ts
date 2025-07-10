export {};

declare global {
    interface Window {
        electron: {
            send: (
                channel: "show-orb" | "audio-stream-end",
                ...args: any[]
            ) => void;
            receive: (
                channel:
                    | "end-conversation"
                    | "gemini:turn-complete"
                    | "processing"
                    | "audio-chunk-received"
                    | "audio-stream-complete"
                    | "gemini:audio-chunk"
                    | "gemini:interrupted"
                    | "gemini:session-opened"
                    | "gemini:error"
                    | "gemini:closed",
                func: (...args: any[]) => void
            ) => void;
            removeListener: (channel: string) => void;
            invoke: (
                name:
                    | "error"
                    | "execute-command"
                    | "update-settings"
                    | "get-window-bounds"
                    | "gemini:start-session"
                    | "gemini:close-session"
                    | "livekit:get-token"
                    | "livekit:start-session"
                    | "livekit:stop-agent",
                ...args: any[]
            ) => Promise<any>;
            getAsset: (type: string, ...args: any[]) => Promise<any>;
            reportError: (error: string, source: string) => Promise<void>;
        };
    }
}
