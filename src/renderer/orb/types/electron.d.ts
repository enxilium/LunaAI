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
            getAsset: (type: "images", ...args: any[]) => Promise<any>; // Only supports 'images' for main process assets
            getKey: (keyName: string) => Promise<string | null>; // Separate method for credentials
            getAllSettings: () => Promise<any>;
            getSetting: (key: string) => Promise<any>;
            updateSetting: (key: string, value: any) => void;
            reportError: (error: string, source: string) => Promise<void>;
            getLiveKitToken: () => Promise<string>;
            getLiveKitServerUrl: () => Promise<string>;
        };
    }
}
