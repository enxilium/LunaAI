import { useState, useRef, useEffect } from "react";
import StreamingService from "../services/StreamingService";

export interface ConnectionState {
    isSpeaking: boolean;
    isMuted: boolean;
    isSharingScreen: boolean;
    audioData: Float32Array | null;
    isConnected: boolean;
}

interface UseConnectionReturn {
    connectionState: ConnectionState;
    startListening: () => Promise<void>;
    stopListening: () => Promise<void>;
    toggleMute: () => void;
    toggleScreenShare: () => Promise<void>;
    sendMessage: (type: string) => void;
}

export const useConnection = (): UseConnectionReturn => {
    const [connectionState, setConnectionState] = useState<ConnectionState>({
        isSpeaking: false,
        isMuted: false,
        isSharingScreen: true, // TODO: Make this dynamic based on user configuration
        audioData: null,
        isConnected: false,
    });

    const streamingRef = useRef<StreamingService | null>(null);

    useEffect(() => {
        streamingRef.current = new StreamingService();

        // Handle agent speaking state changes
        streamingRef.current.onAgentStateChange = (
            state: "listening" | "processing" | "speaking"
        ) => {
            setConnectionState((prev) => ({
                ...prev,
                isSpeaking: state === "speaking",
            }));
        };

        // Handle audio data for visualization
        streamingRef.current.onOutputAudioData = (audioData: Float32Array) => {
            setConnectionState((prev) => ({
                ...prev,
                audioData,
            }));
        };

        // Handle connection state changes
        streamingRef.current.onConnectionChange = (connected: boolean) => {
            setConnectionState((prev) => ({
                ...prev,
                isConnected: connected,
            }));
        };

        // Error handling - stop everything on error
        streamingRef.current.onError = (error: string) => {
            console.error("Streaming error:", error);
            // Reset to default state on error
            setConnectionState({
                isSpeaking: false,
                isMuted: false,
                isSharingScreen: true, // TODO: Make this dynamic based on user configuration
                audioData: null,
                isConnected: false,
            });
        };

        return () => {
            streamingRef.current?.stopStreaming();
        };
    }, []);

    const startListening = async (): Promise<void> => {
        if (!streamingRef.current) {
            throw new Error("Streaming service not initialized");
        }

        await streamingRef.current.startStreaming();

        // Reset states when starting a new session
        setConnectionState((prev) => ({
            ...prev,
            isSpeaking: false,
            isMuted: false, // Default to unmuted when session starts
            isConnected: true,
        }));
    };

    const stopListening = async (): Promise<void> => {
        if (!streamingRef.current) {
            throw new Error("Streaming service not initialized");
        }

        await streamingRef.current.stopStreaming();

        // Reset all states when stopping
        setConnectionState({
            isSpeaking: false,
            isMuted: false,
            isSharingScreen: true, // TODO: Make this dynamic based on user configuration
            audioData: null,
            isConnected: false,
        });
    };

    const toggleMute = (): void => {
        setConnectionState((prev) => ({
            ...prev,
            isMuted: !prev.isMuted,
        }));

        if (streamingRef.current) {
            streamingRef.current.setMicrophoneMuted(!connectionState.isMuted);
        }
    };

    const toggleScreenShare = async (): Promise<void> => {
        if (!streamingRef.current) {
            throw new Error("Streaming service not initialized");
        }

        const newState = !connectionState.isSharingScreen;
        await streamingRef.current.setVideoEnabled(newState);
        setConnectionState((prev) => ({
            ...prev,
            isSharingScreen: newState,
        }));
    };

    const sendMessage = (type: string) => {
        if (!streamingRef.current) {
            throw new Error("Streaming service not initialized");
        }

        streamingRef.current.sendToServer(type);
    };

    return {
        connectionState,
        startListening,
        stopListening,
        toggleMute,
        toggleScreenShare,
        sendMessage,
    };
};
