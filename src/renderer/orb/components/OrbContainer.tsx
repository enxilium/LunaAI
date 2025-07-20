import React, { useState, useEffect, useRef } from "react";
import useKeywordDetection from "../hooks/useKeywordDetection";
import { useKey } from "../hooks/useAssets";
import AudioOrb from "./AudioOrb";
import AudioWorkletStreaming from "../services/AudioWorkletStreaming";

const OrbContainer: React.FC = () => {
    const [isActive, setIsActive] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const streamingManagerRef = useRef<AudioWorkletStreaming | null>(null);

    const { key: accessKey } = useKey("picovoice");
    const { keywordDetection } = useKeywordDetection(accessKey);

    // Initialize streaming manager
    useEffect(() => {
        if (!streamingManagerRef.current) {
            streamingManagerRef.current = new AudioWorkletStreaming();

            // Set up callbacks
            streamingManagerRef.current.onConnectionChange = (connected) => {
                console.log("[Orb] Connection status changed:", connected);
                setIsConnected(connected);
            };

            streamingManagerRef.current.onStreamingStart = () => {
                console.log("[Orb] Streaming started");
                setIsStreaming(true);
            };

            streamingManagerRef.current.onStreamingStop = () => {
                console.log("[Orb] Streaming stopped");
                setIsStreaming(false);
            };

            streamingManagerRef.current.onError = (errorMessage) => {
                console.error("[Orb] Streaming error:", errorMessage);
                setError(errorMessage);
                setIsActive(false);
                setIsStreaming(false);
            };
        }

        return () => {
            // Cleanup on unmount
            if (streamingManagerRef.current) {
                streamingManagerRef.current.stopStreaming();
            }
        };
    }, []);

    // Handle wake word detection
    useEffect(() => {
        const handleWakeWord = async () => {
            if (keywordDetection && !isActive && streamingManagerRef.current) {
                console.log("[Orb] Wake word detected, activating...");
                setIsActive(true);
                setError(null);

                try {
                    // Start audio streaming with Luna AI agent
                    await streamingManagerRef.current.startStreaming();
                    window.electron.send("show-orb");
                } catch (err) {
                    console.error("[Orb] Failed to start streaming:", err);
                    const errorMessage =
                        err instanceof Error ? err.message : "Unknown error";
                    setError(`Failed to start streaming: ${errorMessage}`);
                    setIsActive(false);
                }
            }
        };

        handleWakeWord();
    }, [keywordDetection, isActive]);

    const handleDeactivate = async () => {
        console.log("[Orb] Deactivating...");
        setIsActive(false);

        if (streamingManagerRef.current) {
            await streamingManagerRef.current.stopStreaming();
        }

        window.electron.send("hide-orb");
    };

    // Handle manual activation (for testing)
    const handleManualActivate = async () => {
        if (!isActive && streamingManagerRef.current) {
            console.log("[Orb] Manual activation...");
            setIsActive(true);
            setError(null);

            try {
                await streamingManagerRef.current.startStreaming();
                window.electron.send("show-orb");
            } catch (err) {
                console.error("[Orb] Failed to start streaming:", err);
                const errorMessage =
                    err instanceof Error ? err.message : "Unknown error";
                setError(`Failed to start streaming: ${errorMessage}`);
                setIsActive(false);
            }
        }
    };

    return (
        <div className="orb-container">
            {error && (
                <div
                    className="error-message"
                    style={{ color: "red", marginBottom: "10px" }}
                >
                    {error}
                </div>
            )}

            <div
                className="status-indicators"
                style={{ marginBottom: "10px", fontSize: "12px" }}
            >
                <div>Connected: {isConnected ? "✅" : "❌"}</div>
                <div>Streaming: {isStreaming ? "🎵" : "🔇"}</div>
                <div>Active: {isActive ? "🟢" : "🔴"}</div>
            </div>

            <AudioOrb
                color="rgb(150, 50, 255)"
                isActive={isActive}
                onDeactivate={handleDeactivate}
            />

            {/* Manual activation button for testing */}
            {!isActive && (
                <button
                    onClick={handleManualActivate}
                    style={{
                        marginTop: "10px",
                        padding: "8px 16px",
                        background: "rgb(150, 50, 255)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                    }}
                >
                    Start Luna
                </button>
            )}
        </div>
    );
};

export default OrbContainer;
