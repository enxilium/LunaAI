import { useState, useEffect, useRef, useCallback } from "react";

interface AudioChunkData {
    chunk: string; // base64 encoded
}

interface StreamInfo {
    totalBytes: number;
    duration?: number;
}

export default function useAudioPlayback() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [conversationEnd, setConversationEnd] = useState(false);

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
                setIsFinished(false); // Reset finished state when playback starts
            };

            audioElementRef.current.onpause = () => {
                setIsPlaying(false);
            };

            audioElementRef.current.onended = () => {
                console.log("Audio playback ended");
                setIsPlaying(false);
                setIsFinished(true); // Set finished state when playback ends
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
            try {
                if (audioDataRef.current.length === 0) {
                    setIsFinished(true); // Mark as finished even if there's no audio to play
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
                        .catch((err) => {
                            console.error("Error playing audio:", err);
                        });
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

        window.electron.receive("conversation-end", () => {
            setConversationEnd(true);
        });

        // Cleanup function
        return () => {
            if (window.electron) {
                window.electron.removeListener("audio-chunk-received");
                window.electron.removeListener("audio-stream-complete");
                window.electron.removeListener("conversation-end");
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
        setIsFinished(false);
        setConversationEnd(false); // Reset conversationEnd when starting a new audio context
    }, [initializeAudio]);

    return {
        isPlaying,
        isFinished,
        conversationEnd,
        startAudioContext,
    };
}
