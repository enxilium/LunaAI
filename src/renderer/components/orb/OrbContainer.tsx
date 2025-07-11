import React, { useState, useEffect } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { useLiveKit } from "../../hooks/useLiveKit";
import useKeywordDetection from "../../hooks/useKeywordDetection";
import { Room, RoomEvent } from "livekit-client";
import Orb from "./Orb";

// Import LiveKit styles
import "@livekit/components-styles";
import "@livekit/components-styles/prefabs";

const OrbContainer: React.FC = () => {
    const room = new Room({
        // TODO: Configure room options if needed.
    });

    const refreshWarmToken = async () => {
        try {
            console.log("[LiveKit] Refreshing warm token...");

            const { token, url } = await window.electron.invoke(
                "livekit:get-token"
            );

            if (url && token) {
                await room.prepareConnection(url, token);
                console.log("[LiveKit] Connection pre-warmed.");
            } else {
                console.warn("[LiveKit] Could not get a warmup token.");
            }
        } catch (error) {
            console.error("[LiveKit] Failed to pre-warm connection:", error);
        }
    }

    useEffect(() => {
        // TODO: Is manually setting these styles here the correct approach, or should they be defined elsewhere?
        document.body.setAttribute("data-window-type", "orb");
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.overflow = "hidden";

        refreshWarmToken();

        return () => {
            document.body.removeAttribute("data-window-type");
            document.body.style.margin = "";
            document.body.style.padding = "";
            document.body.style.overflow = "";
        };
    }, []);

    useEffect(() => {
        refreshWarmToken(); // Run once application start

        const interval = setInterval(() => {
            refreshWarmToken();
        }, 45 * 60 * 1000); // Run every 45 minutes

        return () => clearInterval(interval);
    }, []);

    const {
        serverUrl,
        token,
        isConnecting,
        setIsConnecting,
        startSession,
        stopSession,
    } = useLiveKit();
    const [accessKey, setAccessKey] = useState<string | null>(null);
    const [showPanel, setShowPanel] = useState(false);
    const [panelCollapsed, setPanelCollapsed] = useState(true);
    const [panelSide, setPanelSide] = useState<"left" | "right">("left");

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

    useEffect(() => {
        const updatePanelSide = async () => {
            try {
                const bounds = await window.electron.invoke("get-window-bounds");
                const screenWidth = window.screen.width;
                const windowCenterX = bounds.x + bounds.width / 2;
                setPanelSide(windowCenterX > screenWidth / 2 ? "left" : "right");
            } catch (error) {
                console.warn("[Orb] Failed to get window bounds:", error);
            }
        };

        updatePanelSide();
        const interval = setInterval(updatePanelSide, 1000);
        return () => clearInterval(interval);
    }, []);

    const { isKeywordDetected } = useKeywordDetection(accessKey);

    useEffect(() => {
        if (isKeywordDetected && !isConnecting && !serverUrl) {
            console.log("[Orb] Wake word detected, starting session...");
            startSession();
        }
    }, [isKeywordDetected, isConnecting, serverUrl, startSession]);

    const handleOrbClick = () => {
        if (serverUrl) {
            if (showPanel) {
                if (panelCollapsed) {
                    setPanelCollapsed(false);
                } else {
                    setShowPanel(false);
                    setPanelCollapsed(true);
                }
            } else {
                setShowPanel(true);
                setPanelCollapsed(true);
            }
        } else {
            startSession();
        }
    };

    const handleStopSession = () => {
        stopSession();
        setShowPanel(false);
        setPanelCollapsed(true);
    };

    return (
        <LiveKitRoom
            serverUrl={serverUrl}
            token={token}
            connect={true}
            audio={true}
            video={false}
            onConnected={() => {
                console.log("[User] Connected to room.");
                window.electron.send("show-orb");
                setIsConnecting(false);
            }}
            onDisconnected={() => {
                console.log("[User] Disconnected from room.");
            }}
            onError={(error) => {
                console.error("[Orb] LiveKit error:", error);
                setIsConnecting(false);
            }}
        >
            <RoomAudioRenderer />
            <Orb
                onStopSession={handleStopSession}
                onOrbClick={handleOrbClick}
                showPanel={showPanel}
                panelCollapsed={panelCollapsed}
                panelSide={panelSide}
                setPanelCollapsed={setPanelCollapsed}
                isInitializing={isConnecting}
                accessKey={accessKey}
            />
        </LiveKitRoom>
    );
};

export default OrbContainer;

