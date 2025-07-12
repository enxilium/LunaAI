import React, { useState, useEffect } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import useKeywordDetection from "../../hooks/useKeywordDetection";
import { useConnection } from "../../hooks/useConnection";
import Orb from "./Orb";

const OrbContainer: React.FC = () => {
    const { room, wsUrl, token, shouldConnect, connect, disconnect } =
        useConnection();
    const [isConnecting, setIsConnecting] = useState(false);
    const [accessKey, setAccessKey] = useState<string | null>(null);

    useEffect(() => {
        const getAccessKey = async () => {
            try {
                const key = await window.electron.getAsset("key", "picovoice");
                setAccessKey(key);
            } catch (error) {
                console.warn("[Orb] Failed to get Picovoice key:", error);
            }
        };
        getAccessKey();
    }, []);

    const { isKeywordDetected } = useKeywordDetection(accessKey);

    useEffect(() => {
        const handleWakeWord = () => {
            if (isKeywordDetected && !shouldConnect && !isConnecting) {
                console.log("[Orb] Wake word detected, starting session...");
                setIsConnecting(true);
                connect();
            }
        };
        handleWakeWord();
    }, [isKeywordDetected, shouldConnect, connect, isConnecting]);

    useEffect(() => {
        if (!shouldConnect) {
            setIsConnecting(false);
        }
    }, [shouldConnect]);

    if (!shouldConnect) {
        return <h1>Waiting for wake word...</h1>;
    }

    return (
        <LiveKitRoom
            room={room}
            serverUrl={wsUrl}
            token={token}
            audio={true}
            video={false}
            onConnected={() => {
                console.log("[User] Connected to room.");
                setIsConnecting(false);
            }}
            onDisconnected={() => {
                console.log("[User] Disconnected from room.");
                disconnect();
            }}
            onError={(error) => {
                console.error("[Orb] LiveKit error:", error);
                disconnect();
            }}
        >
            <RoomAudioRenderer />
            <Orb />
        </LiveKitRoom>
    );
};

export default OrbContainer;
