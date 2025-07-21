import React, { useEffect } from "react";
import useKeywordDetection from "../hooks/useKeywordDetection";
import { useConnection } from "../hooks/useConnection";
import { useKey } from "../hooks/useAssets";
import AudioOrb from "./AudioOrb";

const OrbContainer: React.FC = () => {
    const { key: accessKey } = useKey("picovoice");
    const { keywordDetection } = useKeywordDetection(accessKey);
    const {
        isConnected,
        agentState,
        inputAudioData,
        outputAudioData,
        startSession,
        stopSession,
        setMicrophoneMuted,
        setOutputVolume,
        error,
    } = useConnection();

    const isActive =
        agentState === "speaking" ||
        agentState === "processing" ||
        Boolean(inputAudioData || outputAudioData);

    // Handle wake word detection
    useEffect(() => {
        const handleWakeWord = async () => {
            if (keywordDetection && !isConnected) {
                console.log("🎤 Wake word detected");

                try {
                    await startSession();
                    window.electron.send("show-orb");
                } catch (err) {
                    console.error("❌ Failed to start session:", err);
                }
            }
        };

        handleWakeWord();
    }, [keywordDetection, isConnected, startSession]); // Handle manual deactivation
    const handleDeactivate = async () => {
        try {
            await stopSession();
            window.electron.send("hide-orb");
        } catch (err) {
            console.error("❌ Failed to stop session:", err);
        }
    };

    // Handle manual activation (for testing)
    const handleManualActivate = async () => {
        if (!isConnected) {
            try {
                await startSession();
                window.electron.send("show-orb");
            } catch (err) {
                console.error("❌ Failed to start session:", err);
            }
        }
    };

    return (
        <div className="orb-container">
            {error && (
                <div
                    style={{
                        color: "red",
                        marginBottom: "10px",
                        fontSize: "12px",
                    }}
                >
                    {error}
                </div>
            )}

            <div style={{ marginBottom: "10px", fontSize: "12px" }}>
                <div>Session: {isConnected ? "✅ Active" : "❌ Inactive"}</div>
                <div>
                    Agent: {agentState} {isActive ? "🟢" : "⚪"}
                </div>
                <div>
                    Audio: {inputAudioData ? "🎤" : "🔇"}{" "}
                    {outputAudioData ? "🔊" : "🔇"}
                </div>
            </div>

            <AudioOrb
                color="rgb(150, 50, 255)"
                isActive={isActive}
                onDeactivate={handleDeactivate}
            />

            {/* Manual controls for testing */}
            <div style={{ marginTop: "10px" }}>
                {!isConnected && (
                    <button
                        onClick={handleManualActivate}
                        style={{
                            padding: "4px 8px",
                            margin: "2px",
                            background: "rgb(150, 50, 255)",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "10px",
                        }}
                    >
                        Start Session
                    </button>
                )}

                {isConnected && (
                    <button
                        onClick={() => setMicrophoneMuted(true)}
                        style={{
                            padding: "4px 8px",
                            margin: "2px",
                            background: "orange",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "10px",
                        }}
                    >
                        Mute Mic
                    </button>
                )}

                {isConnected && (
                    <button
                        onClick={() => setMicrophoneMuted(false)}
                        style={{
                            padding: "4px 8px",
                            margin: "2px",
                            background: "green",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "10px",
                        }}
                    >
                        Unmute Mic
                    </button>
                )}

                <button
                    onClick={() => setOutputVolume(0.5)}
                    style={{
                        padding: "4px 8px",
                        margin: "2px",
                        background: "gray",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "10px",
                    }}
                >
                    Vol 50%
                </button>

                <button
                    onClick={() => setOutputVolume(1.0)}
                    style={{
                        padding: "4px 8px",
                        margin: "2px",
                        background: "gray",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "10px",
                    }}
                >
                    Vol 100%
                </button>
            </div>
        </div>
    );
};

export default OrbContainer;
