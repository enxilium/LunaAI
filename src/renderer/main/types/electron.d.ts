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
            // Screen sharing methods
            getScreenSources: () => Promise<
                Array<{
                    id: string;
                    name: string;
                    display_id: string;
                    thumbnail: string | null;
                }>
            >;
            getPrimaryScreenSource: () => Promise<{
                id: string;
                name: string;
                display_id: string;
                thumbnail: string | null;
            }>;
            startScreenCapture: (sourceId?: string) => Promise<{
                success: boolean;
                sourceId: string;
                sourceName: string;
                displayId: string;
                message: string;
            }>;
            stopScreenCapture: () => Promise<{
                success: boolean;
                message: string;
            }>;
            getScreenCaptureStatus: () => Promise<{
                isCapturing: boolean;
                hasStream: boolean;
            }>;
            getMediaConstraints: (sourceId: string) => Promise<{
                audio: boolean;
                video: {
                    mandatory: {
                        chromeMediaSource: string;
                        chromeMediaSourceId: string;
                        minWidth: number;
                        maxWidth: number;
                        minHeight: number;
                        maxHeight: number;
                        minFrameRate: number;
                        maxFrameRate: number;
                    };
                };
            }>;
        };
    }
}
