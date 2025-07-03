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
                    | "gemini:start-session"
                    | "gemini:close-session",
                ...args: any[]
            ) => Promise<any>;
            getAsset: (type: string, ...args: any[]) => Promise<any>;
            reportError: (error: string, source: string) => Promise<void>;
        };
    }
}
