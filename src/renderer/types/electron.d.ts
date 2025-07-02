export {};

declare global {
    interface Window {
        electron: {
            send: (
                channel:
                    | "show-orb"
                    | "audio-stream-end",
                ...args: any[]
            ) => void;
            receive: (
                channel:
                    | "end-conversation"
                    | "processing"
                    | "audio-chunk-received"
                    | "audio-stream-complete",
                func: (...args: any[]) => void
            ) => void;
            removeListener: (channel: string) => void;
            invoke: (
                name:
                    | "error"
                    | "authorize-service"
                    | "disconnect-service"
                    | "execute-command"
                    | "update-settings",
                ...args: any[]
            ) => Promise<any>;
            getAsset: (type: string, ...args: any[]) => Promise<any>;
            reportError: (error: string, source: string) => Promise<void>;
        };
    }
}
