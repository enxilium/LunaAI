"use client";

import React, {
    createContext,
    useState,
    useEffect,
    useMemo,
    useCallback,
} from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { useScreenShare } from "./rpc/useScreenShare";
import { useTextTyping } from "./rpc/useTextTyping";

type ConnectionData = {
    room: Room;
    shouldConnect: boolean;
    wsUrl: string;
    token: string;
    disconnect: () => void;
    connect: () => void;
};

const ConnectionContext = createContext<ConnectionData | undefined>(undefined);

export const ConnectionProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const room = useMemo(() => new Room({}), []);
    const [shouldConnect, setShouldConnect] = useState<boolean>(false);
    const [wsUrl, setWsUrl] = useState<string>("");
    const [token, setToken] = useState<string>("");

    const { startScreenShare, stopScreenShare } = useScreenShare();
    const { typeText, clearText } = useTextTyping();

    useEffect(() => {
        const getWsUrl = async () => {
            const url = await window.electron.getLiveKitServerUrl();
            setWsUrl(url);
        };
        getWsUrl();
    }, []);

    useEffect(() => {
        if (!wsUrl) {
            return;
        }

        const prewarmConnection = async () => {
            const initialToken = await window.electron.getLiveKitToken();
            setToken(initialToken);
            await room.prepareConnection(wsUrl, initialToken);
        };

        prewarmConnection();
    }, [wsUrl, room]);

    // Register RPC method for screen sharing
    useEffect(() => {
        if (!room || !room.localParticipant) {
            return;
        }

        const handleScreenShareRequest = async (data: any) => {
            try {
                console.log("[RPC] Screen share request received:", data);
                const { enable } = JSON.parse(data.payload);

                if (enable) {
                    const screenStream = await startScreenShare();

                    if (!screenStream) {
                        throw new Error("Failed to start screen capture");
                    }

                    // Create a LocalVideoTrack from the stream
                    const videoTrack = screenStream.getVideoTracks()[0];
                    await room.localParticipant.publishTrack(videoTrack, {
                        source: Track.Source.ScreenShare,
                        name: "screen-share",
                    });
                } else {
                    stopScreenShare();
                }

                return JSON.stringify({ success: true });
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                console.error("[RPC] Screen sharing error:", errorMessage);
                window.electron.reportError(
                    `Screen sharing RPC error: ${errorMessage}`,
                    "useConnection"
                );
                return JSON.stringify({ success: false, error: errorMessage });
            }
        };

        // Register the RPC method
        room.registerRpcMethod("start_screen_share", handleScreenShareRequest);

        // Cleanup function
        return () => {
            room.unregisterRpcMethod("start_screen_share");
        };
    }, [room]);

    // Register RPC method for text typing
    useEffect(() => {
        if (!room || !room.localParticipant) {
            return;
        }

        const handleTextTypingRequest = async (data: any) => {
            try {
                console.log("[RPC] Text typing request received:", data);
                const { action, text } = JSON.parse(data.payload);

                let result;
                switch (action) {
                    case "type":
                        if (!text) {
                            throw new Error("No text provided for typing");
                        }
                        result = await typeText(text);
                        break;
                    case "clear":
                        result = await clearText();
                        break;
                    default:
                        throw new Error(`Unknown action: ${action}`);
                }

                return JSON.stringify(result);
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                console.error("[RPC] Text typing error:", errorMessage);
                window.electron.reportError(
                    `Text typing RPC error: ${errorMessage}`,
                    "useConnection"
                );
                return JSON.stringify({
                    success: false,
                    message: errorMessage,
                });
            }
        };

        // Register the RPC method
        room.registerRpcMethod("text_typing", handleTextTypingRequest);

        // Cleanup function
        return () => {
            room.unregisterRpcMethod("text_typing");
        };
    }, [room, typeText, clearText]);

    const connect = useCallback(async () => {
        if (shouldConnect || !token) {
            return;
        }

        try {
            // Prebuffer microphone to capture audio immediately.
            room.localParticipant
                .setMicrophoneEnabled(true, undefined, {
                    preConnectBuffer: true,
                })
                .then(() => {
                    window.electron.send("show-orb");
                })
                .catch((error) => {
                    window.electron.reportError(
                        `Failed to enable microphone: ${error}`,
                        "useConnection"
                    );
                });

            setShouldConnect(true);
        } catch (error) {
            window.electron.reportError(
                `Failed to enable microphone or connect: ${error}`,
                "useConnection"
            );
        }
    }, [shouldConnect, room, token]);

    const disconnect = useCallback(() => {
        setShouldConnect(false);
        // Disconnect the underlying room object to clean up resources.
        room.disconnect();
    }, [room]);

    return (
        <ConnectionContext.Provider
            value={{
                room,
                wsUrl,
                token,
                shouldConnect,
                connect,
                disconnect,
            }}
        >
            {children}
        </ConnectionContext.Provider>
    );
};

export const useConnection = () => {
    const context = React.useContext(ConnectionContext);
    if (context === undefined) {
        throw new Error(
            "useConnection must be used within a ConnectionProvider"
        );
    }
    return context;
};
