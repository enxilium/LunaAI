export {};

declare global {
    interface Window {
        electron: {
            send: (command: {command: string, args: any}) => void;
            receive: (channel: 'system-response' | 'error-response', func: (...args: any[]) => void) => void;
        };
    }
}