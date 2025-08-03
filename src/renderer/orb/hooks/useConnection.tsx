"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
    useCallback,
} from "react";
import ConnectionManager from "../services/ConnectionManager";

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

    // Audio data for visualization
    const [inputAudioData, setInputAudioData] = useState<Float32Array | null>(
        null
    );
    const [outputAudioData, setOutputAudioData] = useState<Float32Array | null>(
        null
    );

    // Error state
    const [error, setError] = useState<string | null>(null);

    // Connection manager reference
    const connectionManagerRef = useRef<ConnectionManager | null>(null);

    // Initialize connection manager
    useEffect(() => {
        const initializeManager = async () => {
            try {
                
                connectionManagerRef.current = new ConnectionManager();

                // Set up event listeners
                connectionManagerRef.current.on(
                    "connectionChange",
                    (connected: boolean) => {
                        setIsConnected(connected);
                        if (!connected) {
                            setAgentState("listening");
                        }
                    }
                );

                connectionManagerRef.current.on(
                    "agentStateChange",
                    (state: string) => {
                        setAgentState(state as AgentState);
                    }
                );

                connectionManagerRef.current.on(
                    "inputAudioData",
                    (audioData: Float32Array) => {
                        setInputAudioData(audioData);
                    }
                );

                connectionManagerRef.current.on(
                    "outputAudioData",
                    (audioData: Float32Array) => {
                        setOutputAudioData(audioData);
                    }
                );

                connectionManagerRef.current.on(
                    "error",
                    (errorMessage: string) => {
                        setError(errorMessage);
                        console.error(
                            "[ConnectionProvider] ConnectionManager error:",
                            errorMessage
                        );
                    }
                );

                // Initialize the manager
                const initialized =
                    await connectionManagerRef.current.initialize();
                if (!initialized) {
                    throw new Error("Failed to initialize ConnectionManager");
                }

            } catch (error) {
                console.error(
                    "[ConnectionProvider] Failed to initialize ConnectionManager:",
                    error
                );
                setError(`Initialization failed: ${error}`);
            }
        };

        initializeManager();

        // Cleanup on unmount
        return () => {
            if (connectionManagerRef.current) {
                connectionManagerRef.current.destroy();
                connectionManagerRef.current = null;
            }
        };
    }, []);

    // Session controls
    const startSession = useCallback(async () => {
        if (!connectionManagerRef.current) {
            setError("ConnectionManager not initialized");
            return;
        }

        try {
            setError(null);
            await connectionManagerRef.current.startStreaming();
            setIsMicrophoneMuted(false); // Unmute when session starts
            console.log("[ConnectionProvider] Session started successfully");
        } catch (error) {
            console.error(
                "[ConnectionProvider] Failed to start session:",
                error
            );
            setError(`Failed to start session: ${error}`);
        }
    }, []);

    const stopSession = useCallback(async () => {
        if (!connectionManagerRef.current) return;

        try {
            setError(null);
            await connectionManagerRef.current.stopStreaming();
            setIsMicrophoneMuted(true); // Mute when session stops
            setAgentState("listening");
            console.log("[ConnectionProvider] Session stopped successfully");
        } catch (error) {
            console.error(
                "[ConnectionProvider] Failed to stop session:",
                error
            );
            setError(`Failed to stop session: ${error}`);
        }
    }, []);

    const setMicrophoneMuted = useCallback((muted: boolean) => {
        if (!connectionManagerRef.current) return;

        connectionManagerRef.current.setMuted(muted);
        setIsMicrophoneMuted(muted);
        console.log(
            `[ConnectionProvider] Microphone ${muted ? "muted" : "unmuted"}`
        );
    }, []);

    const setOutputVolume = useCallback((volume: number) => {
        if (!connectionManagerRef.current) return;

        connectionManagerRef.current.setOutputVolume(volume);
        console.log(
            `[ConnectionProvider] Output volume set to ${Math.round(
                volume * 100
            )}%`
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
