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
            getAsset: (
                assetName: string,
                assetType?: string | null
            ) => Promise<string>; // Unified asset/resource path getter
            getKey: (keyName: string) => Promise<string | null>; // Separate method for credentials
            getAllSettings: () => Promise<any>;
            getSetting: (key: string) => Promise<any>;
            updateSetting: (key: string, value: any) => void;
            reportError: (error: string, source: string) => Promise<void>;
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
            // Text typing methods
            checkActiveTextInput: () => Promise<{
                success: boolean;
                isActive: boolean;
                message: string;
            }>;
            typeText: (text: string) => Promise<{
                success: boolean;
                message: string;
            }>;
            clearTextField: () => Promise<{
                success: boolean;
                message: string;
            }>;
            // Mouse control methods
            controlMouse: (params: {
                action:
                    | "click"
                    | "move"
                    | "scroll"
                    | "doubleclick"
                    | "drag"
                    | "release";
                x?: number;
                y?: number;
                button?: "left" | "right" | "middle";
                scrollDirection?: "up" | "down";
                scroll_amount?: number;
                reasoning?: string;
            }) => Promise<{
                success: boolean;
                message: string;
                action?: string;
                coordinates?: { x: number; y: number };
                button?: string;
            }>;
        };
    }
}
