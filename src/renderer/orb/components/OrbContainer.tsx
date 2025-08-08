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
        startListening,
        stopListening,
        toggleMute,
        toggleScreenShare,
        sendMessage,
    } = useConnection();

    const { isSpeaking, isMuted, isSharingScreen, audioData, isConnected } = connectionState;

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
    }, [keywordDetection]);

    const stopSession = async () => {
        try {
            sendMessage("stop_session");
            await stopListening();
            window.electron.send("hide-orb");
        } catch (err) {
            console.error("Failed to stop session:", err);
        }
    };

    return (
        <div className="orb-container">
            <div style={{ marginBottom: "10px", fontSize: "12px" }}>
                <div>Speaking: {isSpeaking ? "🗣️ Yes" : "⚪ No"}</div>
                <div>Microphone: {isMuted ? "🔇 Muted" : "🎤 Active"}</div>
                <div>Screen Share: {isSharingScreen ? "📹 On" : "📵 Off"}</div>
            </div>

            <AudioOrb
                color="rgb(150, 50, 255)"
                isSpeaking={isSpeaking}
                audioData={audioData}
                onDeactivate={stopSession}
            />

            {/* Manual controls for testing */}
            <div style={{ marginTop: "10px" }}>
                <button
                    onClick={stopSession}
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
                    Stop Session
                </button>

                <button
                    onClick={toggleMute}
                    style={{
                        padding: "4px 8px",
                        margin: "2px",
                        background: isMuted ? "orange" : "green",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "10px",
                    }}
                >
                    {isMuted ? "Unmute" : "Mute"}
                </button>

                <button
                    onClick={toggleScreenShare}
                    style={{
                        padding: "4px 8px",
                        margin: "2px",
                        background: isSharingScreen ? "blue" : "gray",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "10px",
                    }}
                >
                    {isSharingScreen
                        ? "Stop Screen Share"
                        : "Start Screen Share"}
                </button>
            </div>
        </div>
    );
};

export default OrbContainer;
