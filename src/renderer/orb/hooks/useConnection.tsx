"use client";

import React, {
    createContext,
    useState,
    useEffect,
    useMemo,
    useCallback,
} from "react";
import { Room, RoomEvent } from "livekit-client";

type ConnectionData = {
    room: Room;
    shouldConnect: boolean;
    wsUrl: string;
    token: string;
    disconnect: () => void;
    connect: () => void;
};

const ConnectionContext = createContext<ConnectionData | undefined>(undefined);

export const ConnectionProvider = ({children}: {children: React.ReactNode;}) => {
    const room = useMemo(() => new Room({}), []);
    const [shouldConnect, setShouldConnect] = useState<boolean>(false);
    const [wsUrl, setWsUrl] = useState<string>("");
    const [token, setToken] = useState<string>("");

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
