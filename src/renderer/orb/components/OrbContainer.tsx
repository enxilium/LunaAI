import React, { useState, useEffect } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import useKeywordDetection from "../hooks/useKeywordDetection";
import { useConnection } from "../hooks/useConnection";
import { useKey } from "../hooks/useAssets";
import AudioOrb from "./AudioOrb";

const OrbContainer: React.FC = () => {
    const { room, wsUrl, token, shouldConnect, connect, disconnect } =
        useConnection();
    const [isConnecting, setIsConnecting] = useState(false);

    const { key: accessKey } = useKey("picovoice");
    const { keywordDetection } = useKeywordDetection(accessKey);

    useEffect(() => {
        const handleWakeWord = () => {
            if (keywordDetection && !shouldConnect && !isConnecting) {
                console.log("[Orb] Wake word detected, starting session...");
                setIsConnecting(true);
                connect();
            }
        };
        handleWakeWord();
    }, [keywordDetection, shouldConnect, connect, isConnecting]);

    useEffect(() => {
        if (!shouldConnect) {
            setIsConnecting(false);
        }
    }, [shouldConnect]);

    return (
        <LiveKitRoom
            room={room}
            serverUrl={wsUrl}
            token={token}
            connect={shouldConnect}
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
                window.electron.reportError(
                    `LiveKit room error: ${
                        error instanceof Error ? error.message : error
                    }`,
                    "OrbContainer"
                );
                disconnect();
            }}
        >
            <RoomAudioRenderer />
            <AudioOrb color="rgb(150, 50, 255)" />
        </LiveKitRoom>
    );
};

export default OrbContainer;
