import React, { useEffect } from "react";
import useKeywordDetection from "../hooks/useKeywordDetection";
import { useConnection } from "../hooks/useConnection";
import { useKey } from "../hooks/useAssets";
import AudioOrb from "./AudioOrb";

const OrbContainer: React.FC = () => {
    const { key: accessKey } = useKey("picovoice");
    const { keywordDetection } = useKeywordDetection(accessKey);
    const {
        connectionState,
        audioRef,
        startListening,
        stopListening,
        toggleVideoStreaming,
    } = useConnection();

    const { isConnected, isListening, error, isStreamingVideo } =
        connectionState;

    // Handle wake word detection
    useEffect(() => {
        const handleWakeWord = async () => {
            if (keywordDetection && !isConnected) {
                console.log("🎤 Wake word detected");

                try {
                    await startListening();
                    window.electron.send("show-orb");
                } catch (err) {
                    console.error("❌ Failed to start session:", err);
                }
            }
        };

        handleWakeWord();
    }, [keywordDetection, isConnected, startListening]);

    // Handle manual deactivation
    const handleDeactivate = async () => {
        try {
            await stopListening();
            window.electron.send("hide-orb");
        } catch (err) {
            console.error("❌ Failed to stop session:", err);
        }
    };

    // Handle manual activation (for testing)
    const handleManualActivate = async () => {
        if (!isConnected) {
            try {
                await startListening();
                window.electron.send("show-orb");
            } catch (err) {
                console.error("❌ Failed to start session:", err);
            }
        }
    };

    return (
        <div className="orb-container">
            {/* Hidden audio ref for AudioWorklet */}
            <div ref={audioRef} style={{ display: "none" }} />

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
                <div>Connected: {isConnected ? "✅ Yes" : "❌ No"}</div>
                <div>
                    Listening: {isListening ? "🎤 Active" : "⚪ Inactive"}
                </div>
                <div>Video: {isStreamingVideo ? "� Streaming" : "� Off"}</div>
            </div>

            <AudioOrb
                color="rgb(150, 50, 255)"
                isActive={isListening}
                onDeactivate={handleDeactivate}
            />

            {/* Manual controls for testing */}
            <div style={{ marginTop: "10px" }}>
                {!isListening && (
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
                        Start Listening
                    </button>
                )}

                {isListening && (
                    <button
                        onClick={handleDeactivate}
                        style={{
                            padding: "4px 8px",
                            margin: "2px",
                            background: "red",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "10px",
                        }}
                    >
                        Stop Listening
                    </button>
                )}

                <button
                    onClick={toggleVideoStreaming}
                    style={{
                        padding: "4px 8px",
                        margin: "2px",
                        background: isStreamingVideo ? "orange" : "green",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "10px",
                    }}
                >
                    {isStreamingVideo ? "Stop Video" : "Start Video"}
                </button>
            </div>
        </div>
    );
};

export default OrbContainer;
