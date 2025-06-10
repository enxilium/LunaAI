import { useState, useEffect, useRef, useCallback } from "react";

interface AudioChunkData {
    chunk: string; // base64 encoded
    totalBytes: number;
}

interface StreamInfo {
    totalBytes: number;
    duration?: number;
    isFinal?: boolean;
}

export default function useAudioPlayback() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    // We'll use an Audio element for MP3 playback - much simpler than Web Audio API for PCM
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const audioDataRef = useRef<Uint8Array[]>([]);
    const audioUrlRef = useRef<string | null>(null);

    // Initialize audio
    const initializeAudio = useCallback(() => {
        if (!audioElementRef.current) {
            audioElementRef.current = new Audio();

            audioElementRef.current.onplay = () => {
                setIsPlaying(true);
            };

            audioElementRef.current.onpause = () => {
                setIsPlaying(false);
            };

            audioElementRef.current.onended = () => {
                setIsPlaying(false);
                // Clean up URL objects
                if (audioUrlRef.current) {
                    URL.revokeObjectURL(audioUrlRef.current);
                    audioUrlRef.current = null;
                }
            };
            setIsInitialized(true);
        }
    }, []);

    // Handle incoming audio chunks
    const playChunk = useCallback((chunkData: AudioChunkData) => {
        try {
            // Convert base64 to binary
            const binaryString = atob(chunkData.chunk);
            const chunk = new Uint8Array(binaryString.length);

            for (let i = 0; i < binaryString.length; i++) {
                chunk[i] = binaryString.charCodeAt(i);
            }

            // Store the chunk
            audioDataRef.current.push(chunk);
        } catch (error) {
            console.error("Error processing MP3 chunk:", error);
        }
    }, []);

    // Handle stream end - play the complete audio
    const handleStreamEnd = useCallback(
        (streamInfo: StreamInfo) => {
            console.log("Audio stream complete:", streamInfo);

            if (streamInfo.isFinal) {
                console.log("Final stream confirmed, stopping listening.");
                window.electron.invoke("stop-listening");
            }

            try {
                if (audioDataRef.current.length === 0) {
                    console.log("No audio data to play");
                    return;
                }

                // Initialize audio if needed
                if (!audioElementRef.current) {
                    initializeAudio();
                }

                // Calculate total length
                const totalLength = audioDataRef.current.reduce(
                    (sum, chunk) => sum + chunk.length,
                    0
                );

                // Create a combined buffer
                const combinedBuffer = new Uint8Array(totalLength);
                let offset = 0;

                // Copy all chunks to the combined buffer
                for (const chunk of audioDataRef.current) {
                    combinedBuffer.set(chunk, offset);
                    offset += chunk.length;
                }

                // Create blob and URL
                const blob = new Blob([combinedBuffer], { type: "audio/mpeg" });

                // Clean up previous URL if exists
                if (audioUrlRef.current) {
                    URL.revokeObjectURL(audioUrlRef.current);
                }

                // Create new URL and play
                audioUrlRef.current = URL.createObjectURL(blob);

                if (audioElementRef.current) {
                    audioElementRef.current.src = audioUrlRef.current;
                    audioElementRef.current
                        .play()
                        .then(() => console.log("Playing MP3 audio"))
                        .catch((err) =>
                            console.error("Error playing audio:", err)
                        );
                }

                // Reset data buffer for next stream
                audioDataRef.current = [];
            } catch (error) {
                console.error("Error playing MP3 audio:", error);
                // Reset data on error
                audioDataRef.current = [];
            }
        },
        [initializeAudio]
    );

    // Set up IPC listeners
    useEffect(() => {
        if (
            !window.electron?.onAudioChunk ||
            !window.electron?.onAudioStreamEnd
        ) {
            console.warn(
                "Audio streaming methods not available in electron API"
            );
            return;
        }

        console.log("Setting up audio streaming listeners");

        // Initialize audio
        initializeAudio();

        // Audio chunk listener
        window.electron.onAudioChunk((chunkData: AudioChunkData) => {
            playChunk(chunkData);
        });

        // Stream end listener
        window.electron.onAudioStreamEnd((streamInfo: StreamInfo) => {
            handleStreamEnd(streamInfo);
        });

        // Cleanup function
        return () => {
            if (window.electron?.removeAudioListeners) {
                window.electron.removeAudioListeners();
            }

            if (audioElementRef.current) {
                audioElementRef.current.pause();
                audioElementRef.current.src = "";
            }

            if (audioUrlRef.current) {
                URL.revokeObjectURL(audioUrlRef.current);
                audioUrlRef.current = null;
            }
        };
    }, [playChunk, handleStreamEnd, initializeAudio]);

    // Manual method to ensure audio is ready
    const startAudioContext = useCallback(() => {
        initializeAudio();
    }, [initializeAudio]);

    return {
        isPlaying,
        isInitialized,
        startAudioContext,
    };
}
