"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
    useCallback,
} from "react";
import AudioWorkletStreaming from "../services/AudioWorkletStreaming";
import VideoStreamingService from "../services/VideoStreamingService";

type AgentState = "listening" | "speaking" | "processing";

type ConnectionData = {
    // Simple states
    isConnected: boolean;
    agentState: AgentState;

    // Audio data for visualization (raw audio samples)
    inputAudioData: Float32Array | null; // User's microphone data
    outputAudioData: Float32Array | null; // Agent's speech data

    // Session controls (only start session when wake word detected!)
    startSession: () => Promise<void>; // Start AI agent session (costs credits)
    stopSession: () => Promise<void>; // Stop AI agent session
    setMicrophoneMuted: (muted: boolean) => void; // Mute/unmute during session
    setOutputVolume: (volume: number) => void; // 0.0 to 1.0

    // Error handling
    error: string | null;
};

const ConnectionContext = createContext<ConnectionData | undefined>(undefined);

export const ConnectionProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    // Simple states
    const [isConnected, setIsConnected] = useState(false);
    const [agentState, setAgentState] = useState<AgentState>("listening");
    const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(true); // Start muted!
    const [isSessionActive, setIsSessionActive] = useState(false); // Track if we have an active session

    // Audio data for visualization
    const [inputAudioData, setInputAudioData] = useState<Float32Array | null>(
        null
    );
    const [outputAudioData, setOutputAudioData] = useState<Float32Array | null>(
        null
    );

    // Error handling
    const [error, setError] = useState<string | null>(null);

    // Audio streaming manager (internal complexity)
    const streamingManagerRef = useRef<AudioWorkletStreaming | null>(null);
    const videoStreamingRef = useRef<VideoStreamingService | null>(null);
    const outputVolumeRef = useRef<number>(1.0);

    // Initialize the streaming manager (always connected when possible)
    useEffect(() => {
        if (!streamingManagerRef.current) {
            streamingManagerRef.current = new AudioWorkletStreaming();

            // Connection management (don't auto-connect!)
            streamingManagerRef.current.onConnectionChange = (connected) => {
                // Only log connection issues, not regular connected status
                if (!connected && isSessionActive) {
                    console.error("🔴 [Connection] Lost connection to server");
                    setError("Lost connection to server");
                }
            };

            streamingManagerRef.current.onStreamingStart = () => {
                console.log("🎤 Luna activated");
                setIsConnected(true);
                setIsSessionActive(true);
                setAgentState("listening");
                setError(null);
            };

            streamingManagerRef.current.onStreamingStop = () => {
                console.log("🔇 Luna deactivated");
                setIsConnected(false);
                setIsSessionActive(false);
                setAgentState("listening"); // Reset to listening for next session
                setInputAudioData(null);
                setOutputAudioData(null);
            };

            streamingManagerRef.current.onError = (errorMessage) => {
                console.error("❌ [Connection] Error:", errorMessage);
                setError(errorMessage);
            };

            // Audio data callbacks (no volume calculation, just raw data)
            streamingManagerRef.current.onInputAudioData = (
                audioData: Float32Array
            ) => {
                if (!isMicrophoneMuted) {
                    setInputAudioData(new Float32Array(audioData));
                }
            };

            streamingManagerRef.current.onOutputAudioData = (
                audioData: Float32Array
            ) => {
                // Audio data already has volume applied by AudioWorkletStreaming
                setOutputAudioData(new Float32Array(audioData));
                setAgentState("speaking");
            };

            streamingManagerRef.current.onAgentStateChange = (
                state: "listening" | "speaking" | "processing"
            ) => {
                setAgentState(state);
            };

            // Pre-warm audio system for faster wake word response
            streamingManagerRef.current.preWarm().then((success) => {
                if (!success) {
                    console.warn("⚠️ Audio pre-warming failed");
                }
            });
        }

        // Cleanup on unmount
        return () => {
            if (streamingManagerRef.current) {
                streamingManagerRef.current.stopStreaming();
            }
            if (videoStreamingRef.current) {
                videoStreamingRef.current.destroy();
            }
        };
    }, []);

    // Control methods
    const startSession = useCallback(async () => {
        if (streamingManagerRef.current && !isSessionActive) {
            try {
                setError(null);
                await streamingManagerRef.current.startStreaming();
                setIsMicrophoneMuted(false); // Unmute when session starts

                // Auto-start video streaming for multimodal experience
                if (!videoStreamingRef.current) {
                    console.log("🎬 Initializing video streaming...");
                    videoStreamingRef.current = new VideoStreamingService();
                    const initialized =
                        await videoStreamingRef.current.initialize();
                    if (!initialized) {
                        console.warn(
                            "⚠️ Video streaming initialization failed, continuing with audio only"
                        );
                    } else {
                        console.log(
                            "✅ Video streaming initialized successfully"
                        );
                    }
                }

                // Start video capture if we have a WebSocket and video is initialized
                if (
                    videoStreamingRef.current &&
                    streamingManagerRef.current?.getWebSocket()
                ) {
                    const websocket =
                        streamingManagerRef.current.getWebSocket();
                    if (websocket) {
                        videoStreamingRef.current.startCapture(websocket);
                        console.log(
                            "🎬 Video streaming started - desktop capture active"
                        );
                    }
                }
            } catch (err) {
                const errorMessage =
                    err instanceof Error ? err.message : "Unknown error";
                console.error("❌ Failed to start Luna:", errorMessage);
                setError(`Failed to start session: ${errorMessage}`);
                throw err;
            }
        }
    }, [isSessionActive]);

    const stopSession = useCallback(async () => {
        if (streamingManagerRef.current && isSessionActive) {
            try {
                // Stop video streaming first
                if (videoStreamingRef.current) {
                    videoStreamingRef.current.stopCapture();
                    console.log("🎬 Video streaming stopped");
                }

                await streamingManagerRef.current.stopStreaming();
                setIsMicrophoneMuted(true); // Mute when session stops
            } catch (err) {
                const errorMessage =
                    err instanceof Error ? err.message : "Unknown error";
                console.error("❌ Failed to stop Luna:", errorMessage);
                setError(`Failed to stop session: ${errorMessage}`);
                throw err;
            }
        }
    }, [isSessionActive]);

    const setMicrophoneMuted = useCallback(
        (muted: boolean) => {
            if (!isSessionActive && !muted) {
                // If no session and trying to unmute, start a session instead
                startSession().catch(console.error);
                return;
            }

            setIsMicrophoneMuted(muted);
            if (muted) {
                setInputAudioData(null); // Clear input data when muted
            }
            console.log(
                muted ? "🔇 Microphone muted" : "🎤 Microphone unmuted"
            );
        },
        [isSessionActive, startSession]
    );

    const setOutputVolume = useCallback((volume: number) => {
        // Clamp volume between 0.0 and 1.0
        const clampedVolume = Math.max(0.0, Math.min(1.0, volume));
        outputVolumeRef.current = clampedVolume;

        // Apply volume to the audio streaming service
        if (streamingManagerRef.current) {
            streamingManagerRef.current.setOutputVolume(clampedVolume);
        }

        console.log(
            `🔊 Output volume set to ${Math.round(clampedVolume * 100)}%`
        );
    }, []);

    const contextValue: ConnectionData = {
        // Simple states
        isConnected,
        agentState,

        // Audio data for visualization
        inputAudioData,
        outputAudioData,

        // Session controls
        startSession,
        stopSession,
        setMicrophoneMuted,
        setOutputVolume,

        // Error handling
        error,
    };

    return (
        <ConnectionContext.Provider value={contextValue}>
            {children}
        </ConnectionContext.Provider>
    );
};

export const useConnection = () => {
    const context = useContext(ConnectionContext);
    if (context === undefined) {
        throw new Error(
            "useConnection must be used within a ConnectionProvider"
        );
    }
    return context;
};
