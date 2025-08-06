import { useState, useRef, useEffect } from "react";
import AudioWorkletStreaming from "../services/AudioWorkletStreaming";
import VideoStreamingService from "../services/VideoStreamingService";

export interface ConnectionState {
    isConnected: boolean;
    isListening: boolean;
    error: string | null;
    isStreamingVideo: boolean;
}

interface UseConnectionReturn {
    connectionState: ConnectionState;
    audioRef: React.RefObject<HTMLDivElement | null>;
    startListening: () => Promise<void>;
    stopListening: () => Promise<void>;
    toggleVideoStreaming: () => Promise<void>;
}

export const useConnection = (): UseConnectionReturn => {
    const [connectionState, setConnectionState] = useState<ConnectionState>({
        isConnected: false,
        isListening: false,
        error: null,
        isStreamingVideo: false,
    });

    const audioRef = useRef<HTMLDivElement>(null);
    const audioStreamingRef = useRef<AudioWorkletStreaming | null>(null);
    const videoStreamingRef = useRef<VideoStreamingService | null>(null);

    useEffect(() => {
        const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Initialize audio streaming service
        audioStreamingRef.current = new AudioWorkletStreaming();
        audioStreamingRef.current.onError = (error: string) => {
            setConnectionState((prev) => ({
                ...prev,
                error,
                isConnected: false,
                isListening: false,
            }));
        };
        audioStreamingRef.current.onConnectionChange = (connected: boolean) => {
            setConnectionState((prev) => ({
                ...prev,
                isConnected: connected,
                error: connected ? null : prev.error,
            }));
        };

        // Initialize video streaming service
        videoStreamingRef.current = new VideoStreamingService(clientId);
        videoStreamingRef.current.onError = (error: string) => {
            setConnectionState((prev) => ({
                ...prev,
                error,
                isStreamingVideo: false,
            }));
        };

        return () => {
            audioStreamingRef.current?.stopStreaming();
            videoStreamingRef.current?.stopStreaming();
        };
    }, []);

    const startListening = async (): Promise<void> => {
        try {
            if (!audioStreamingRef.current) {
                throw new Error("Audio streaming service not initialized");
            }

            await audioStreamingRef.current.startStreaming();
            setConnectionState((prev) => ({
                ...prev,
                isListening: true,
                error: null,
            }));
        } catch (error) {
            setConnectionState((prev) => ({
                ...prev,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to start listening",
                isListening: false,
            }));
        }
    };

    const stopListening = async (): Promise<void> => {
        try {
            if (!audioStreamingRef.current) {
                throw new Error("Audio streaming service not initialized");
            }

            await audioStreamingRef.current.stopStreaming();
            setConnectionState((prev) => ({ ...prev, isListening: false }));
        } catch (error) {
            setConnectionState((prev) => ({
                ...prev,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to stop listening",
            }));
        }
    };

    const toggleVideoStreaming = async (): Promise<void> => {
        try {
            if (!videoStreamingRef.current || !audioStreamingRef.current) {
                throw new Error("Streaming services not initialized");
            }

            const newState = !connectionState.isStreamingVideo;
            if (newState) {
                // Share the WebSocket connection from audio streaming
                const audioWebSocket = audioStreamingRef.current.getWebSocket();
                await videoStreamingRef.current.startStreaming(
                    audioWebSocket || undefined
                );
            } else {
                await videoStreamingRef.current.stopStreaming();
            }
            setConnectionState((prev) => ({
                ...prev,
                isStreamingVideo: newState,
            }));
        } catch (error) {
            setConnectionState((prev) => ({
                ...prev,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to toggle video streaming",
            }));
        }
    };

    return {
        connectionState,
        audioRef,
        startListening,
        stopListening,
        toggleVideoStreaming,
    };
};
