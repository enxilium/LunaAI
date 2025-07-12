export {};

declare global {
    interface Window {
        electron: {
            send: (
                channel: "show-orb" | "hide-orb" | "update-setting",
                ...args: any[]
            ) => void;
            receive: (channel: "error", func: (...args: any[]) => void) => void;
            removeListener: (channel: string) => void;
            getAsset: (type: string, ...args: any[]) => Promise<any>;
            getAllSettings: () => Promise<any>;
            getSetting: (key: string) => Promise<any>;
            updateSetting: (key: string, value: any) => void;
            reportError: (error: string, source: string) => Promise<void>;
            getLiveKitToken: () => Promise<string>;
            getLiveKitServerUrl: () => Promise<string>;
        };
    }
}
