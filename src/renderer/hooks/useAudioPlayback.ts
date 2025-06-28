import { useState, useEffect, useRef, useCallback } from "react";

interface AudioChunkData {
    chunk: string; // base64 encoded
}

export default function useAudioPlayback() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [nextAction, setNextAction] = useState<string | null>(null);
    const [playbackError, setPlaybackError] = useState<string | null>(null);

    // Audio context for streaming audio
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioBufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const audioQueueRef = useRef<Uint8Array[]>([]);
    const isProcessingQueueRef = useRef<boolean>(false);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const combinedChunksRef = useRef<Uint8Array>(new Uint8Array());
    
    // Track which method is working best
    const useAudioElementFallbackRef = useRef<boolean>(false);
    
    // Debug mode
    const isDebugMode = process.env.NODE_ENV === 'development';

    // Initialize audio context
    const initializeAudio = useCallback(() => {
        if (!audioContextRef.current) {
            try {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                
                // Create audio element only when we're actually going to use it
                // This prevents the initial error at startup
                if (!audioElementRef.current) {
                    if (isDebugMode) console.log("Creating new Audio element");
                    audioElementRef.current = new Audio();
                    audioElementRef.current.preload = "auto"; // Ensure audio preloads
                    
                    // Only set up event handlers after we have actual audio to play
                    // This prevents errors when the audio element is initialized without a source
                    const setupAudioElementHandlers = () => {
                        if (!audioElementRef.current) return;
                        
                        if (isDebugMode) console.log("Setting up audio element handlers");
                        
                        audioElementRef.current.onplay = () => {
                            if (isDebugMode) console.log("Audio element: onplay");
                            setIsPlaying(true);
                            setIsFinished(false);
                        };
                        
                        audioElementRef.current.onpause = () => {
                            if (isDebugMode) console.log("Audio element: onpause");
                            setIsPlaying(false);
                        };
                        
                        audioElementRef.current.onended = () => {
                            if (isDebugMode) console.log("Audio element: onended");
                            setIsPlaying(false);
                            setIsFinished(true);
                        };
                        
                        audioElementRef.current.onerror = (e) => {
                            // Only log real errors, not initialization errors
                            if (audioElementRef.current?.src) {
                                const errorCode = audioElementRef.current.error ? audioElementRef.current.error.code : "unknown";
                                const errorMessage = audioElementRef.current.error ? audioElementRef.current.error.message : "unknown";
                                console.error(`Audio element error (${errorCode}): ${errorMessage}`, e);
                                setPlaybackError(`Audio playback error: ${errorMessage}`);
                            } else if (isDebugMode) {
                                console.log("Audio element initialization error (can be ignored)");
                            }
                        };
                    };
                    
                    // Set up handlers
                    setupAudioElementHandlers();
                }
                
                setIsInitialized(true);
            } catch (error) {
                console.error("Failed to initialize AudioContext:", error);
                // Fall back to audio element only
                if (!audioElementRef.current) {
                    audioElementRef.current = new Audio();
                    setIsInitialized(true);
                }
            }
        }
    }, [isDebugMode]);

    // Clean up blob URLs and reset audio handling
    const cleanupAudio = useCallback(() => {
        // Stop any playing audio
        if (audioBufferSourceRef.current) {
            try {
                audioBufferSourceRef.current.stop();
                audioBufferSourceRef.current.disconnect();
                audioBufferSourceRef.current = null;
            } catch (e) {
                // Ignore errors during cleanup
            }
        }
        
        if (audioElementRef.current) {
            try {
                audioElementRef.current.pause();
                if (audioElementRef.current.src) {
                    URL.revokeObjectURL(audioElementRef.current.src);
                    audioElementRef.current.src = "";
                    audioElementRef.current.load(); // Force reload
                }
            } catch (e) {
                console.error("Error cleaning up audio element:", e);
            }
        }
        
        // Reset queue and processing state
        audioQueueRef.current = [];
        combinedChunksRef.current = new Uint8Array();
        isProcessingQueueRef.current = false;
    }, []);
    
    // Validate that chunk contains valid audio data
    const validateChunk = (chunk: Uint8Array): boolean => {
        // Basic validation - check if chunk has some minimum size 
        // and contains some data
        return chunk.length > 0;
    };

    // Process the audio queue 
    const processAudioQueue = useCallback(async () => {
        if (isProcessingQueueRef.current || audioQueueRef.current.length === 0) {
            return;
        }

        isProcessingQueueRef.current = true;

        try {
            // If we know the Audio element fallback works better, use that directly
            if (useAudioElementFallbackRef.current) {
                processCombinedAudio();
                return;
            }

            // Try to use Web Audio API for streaming
            if (audioContextRef.current && !useAudioElementFallbackRef.current) {
                try {
                    // Process all chunks at once for better decoding
                    const allChunks = audioQueueRef.current.slice();
                    audioQueueRef.current = [];
                    
                    // Combine all chunks
                    let totalLength = 0;
                    allChunks.forEach(chunk => totalLength += chunk.length);
                    
                    const combinedChunk = new Uint8Array(totalLength);
                    let offset = 0;
                    
                    allChunks.forEach(chunk => {
                        combinedChunk.set(chunk, offset);
                        offset += chunk.length;
                    });
                    
                    // Add to our running combined chunks
                    const newCombined = new Uint8Array(combinedChunksRef.current.length + combinedChunk.length);
                    newCombined.set(combinedChunksRef.current);
                    newCombined.set(combinedChunk, combinedChunksRef.current.length);
                    combinedChunksRef.current = newCombined;
                    
                    // Only try to decode if we have enough data (at least 1KB)
                    if (combinedChunksRef.current.length < 1024) {
                        isProcessingQueueRef.current = false;
                        return;
                    }
                    
                    // Decode the audio data
                    const audioBuffer = await audioContextRef.current.decodeAudioData(
                        combinedChunksRef.current.buffer.slice(0) as ArrayBuffer
                    );
                    
                    // Reset combined chunks after successful decode
                    combinedChunksRef.current = new Uint8Array();
                    
                    // Create source node
                    const sourceNode = audioContextRef.current.createBufferSource();
                    sourceNode.buffer = audioBuffer;
                    sourceNode.connect(audioContextRef.current.destination);
                    
                    // Set up event handlers
                    sourceNode.onended = () => {
                        if (audioBufferSourceRef.current === sourceNode) {
                            audioBufferSourceRef.current = null;
                        }
                        
                        setIsPlaying(false);
                        
                        // Process more audio if available
                        isProcessingQueueRef.current = false;
                        if (audioQueueRef.current.length > 0) {
                            processAudioQueue();
                        } else {
                            setIsFinished(true);
                        }
                    };
                    
                    // If we already have an audio source playing, stop it
                    if (audioBufferSourceRef.current) {
                        audioBufferSourceRef.current.stop();
                        audioBufferSourceRef.current.disconnect();
                    }
                    
                    // Start playing
                    sourceNode.start();
                    setIsPlaying(true);
                    setIsFinished(false);
                    
                    // Store reference to current source
                    audioBufferSourceRef.current = sourceNode;
                    return;
                } catch (error) {
                    console.warn("Error decoding audio with Web Audio API, falling back to Audio element:", error);
                    // Mark that we should use the fallback going forward
                    useAudioElementFallbackRef.current = true;
                    
                    // Try fallback
                    processCombinedAudio();
                    return;
                }
            } else {
                // Use Audio element approach
                processCombinedAudio();
            }
        } catch (error) {
            console.error("Error processing audio queue:", error);
            setPlaybackError("Error processing audio");
            isProcessingQueueRef.current = false;
        }
    }, []);
    
    // Process combined audio using audio element as fallback
    const processCombinedAudio = () => {
        try {
            // Process all chunks at once
            const allChunks = audioQueueRef.current.slice();
            audioQueueRef.current = [];
            
            // Skip if no chunks
            if (allChunks.length === 0) {
                isProcessingQueueRef.current = false;
                return;
            }
            
            // Combine all chunks
            let totalLength = 0;
            allChunks.forEach(chunk => totalLength += chunk.length);
            
            const combinedChunk = new Uint8Array(totalLength);
            let offset = 0;
            
            allChunks.forEach(chunk => {
                combinedChunk.set(chunk, offset);
                offset += chunk.length;
            });
            
            // Add to our running combined chunks
            const newCombined = new Uint8Array(combinedChunksRef.current.length + combinedChunk.length);
            newCombined.set(combinedChunksRef.current);
            newCombined.set(combinedChunk, combinedChunksRef.current.length);
            combinedChunksRef.current = newCombined;
            
            // Only try to play if we have enough data
            if (combinedChunksRef.current.length < 1024) {
                isProcessingQueueRef.current = false;
                return;
            }
            
            if (audioElementRef.current) {
                try {
                    // Create blob with proper MIME type
                    const audioBlob = new Blob([combinedChunksRef.current], { 
                        type: "audio/mpeg" 
                    });
                    
                    // Create object URL and play
                    const url = URL.createObjectURL(audioBlob);
                    
                    // Clean up previous URL if exists
                    if (audioElementRef.current.src) {
                        URL.revokeObjectURL(audioElementRef.current.src);
                    }
                    
                    // Set up handlers
                    audioElementRef.current.onended = () => {
                        if (isDebugMode) console.log("Audio chunk playback ended");
                        // Clean up URL
                        if (audioElementRef.current && audioElementRef.current.src) {
                            URL.revokeObjectURL(audioElementRef.current.src);
                        }
                        
                        // Reset for next audio chunks
                        combinedChunksRef.current = new Uint8Array();
                        isProcessingQueueRef.current = false;
                        
                        // Check if more audio is available
                        if (audioQueueRef.current.length > 0) {
                            setTimeout(() => processAudioQueue(), 50);
                        } else {
                            setIsFinished(true);
                        }
                    };
                    
                    // Set source and play
                    audioElementRef.current.src = url;
                    audioElementRef.current.load(); // Force load before playing
                    
                    if (isDebugMode) console.log("Attempting to play audio chunk");
                    const playPromise = audioElementRef.current.play();
                    
                    if (playPromise !== undefined) {
                        playPromise
                            .then(() => {
                                if (isDebugMode) console.log("Audio chunk playing successfully");
                                setIsPlaying(true);
                                setIsFinished(false);
                            })
                            .catch((error) => {
                                console.error("Error playing audio:", error);
                                // Clean up URL
                                if (audioElementRef.current && audioElementRef.current.src) {
                                    URL.revokeObjectURL(audioElementRef.current.src);
                                }
                                
                                // Reset for retry
                                combinedChunksRef.current = new Uint8Array();
                                isProcessingQueueRef.current = false;
                                setPlaybackError("Failed to play audio");
                            });
                    }
                } catch (blobError) {
                    console.error("Error creating or playing blob:", blobError);
                    isProcessingQueueRef.current = false;
                    combinedChunksRef.current = new Uint8Array();
                }
            } else {
                // No audio playback method available
                isProcessingQueueRef.current = false;
                setPlaybackError("No audio playback method available");
            }
        } catch (error) {
            console.error("Error in processCombinedAudio:", error);
            isProcessingQueueRef.current = false;
            combinedChunksRef.current = new Uint8Array();
            setPlaybackError("Error processing combined audio");
        }
    };

    // Handle incoming audio chunks
    const playChunk = useCallback((chunkData: AudioChunkData) => {
        try {
            // Validate base64 string
            if (!chunkData.chunk || typeof chunkData.chunk !== 'string') {
                console.error("Invalid audio chunk received", chunkData);
                return;
            }
            
            // Convert base64 to binary
            const binaryString = atob(chunkData.chunk);
            const chunk = new Uint8Array(binaryString.length);

            for (let i = 0; i < binaryString.length; i++) {
                chunk[i] = binaryString.charCodeAt(i);
            }
            
            // Skip empty chunks
            if (!validateChunk(chunk)) {
                console.warn("Skipping invalid audio chunk");
                return;
            }

            // Add to queue
            audioQueueRef.current.push(chunk);
            
            // Start processing if not already
            if (!isProcessingQueueRef.current) {
                processAudioQueue();
            }
        } catch (error) {
            console.error("Error processing audio chunk:", error);
            setPlaybackError("Error processing audio chunk");
        }
    }, [processAudioQueue]);

    // Handle stream end
    const handleStreamEnd = useCallback(
        (nextAction: string) => {
            setNextAction(nextAction);
            // Process any remaining audio
            if (!isProcessingQueueRef.current && audioQueueRef.current.length > 0) {
                processAudioQueue();
            }
            
            // If there's no more audio to play and we're not playing anything, mark as finished
            if (audioQueueRef.current.length === 0 && !isProcessingQueueRef.current) {
                setIsFinished(true);
            }
        },
        [processAudioQueue, isDebugMode]
    );

    // Set up IPC listeners
    useEffect(() => {
        // Initialize audio
        initializeAudio();

        // Audio chunk listener
        window.electron.onAudioChunk((chunkData: AudioChunkData) => {
            if (isDebugMode) console.log("Audio chunk received");
            playChunk(chunkData);
        });

        // Stream end listener
        window.electron.onAudioStreamEnd((nextAction: string) => {
            handleStreamEnd(nextAction);
        });

        window.electron.receive("conversation-end", () => {
            setNextAction("conversation-end");
        });

        // Cleanup function
        return () => {
            if (window.electron) {
                window.electron.removeListener("audio-chunk-received");
                window.electron.removeListener("audio-stream-complete");
                window.electron.removeListener("conversation-end");
            }

            cleanupAudio();
        };
    }, [playChunk, handleStreamEnd, initializeAudio, cleanupAudio, isDebugMode]);

    // Manual method to ensure audio is ready
    const startAudioContext = useCallback(() => {
        initializeAudio();
        cleanupAudio();
        setIsFinished(false);
        setNextAction(null);
        setPlaybackError(null);
        
        // Resume audio context (needed due to browser autoplay policies)
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    }, [initializeAudio, cleanupAudio]);

    return {
        isPlaying,
        isFinished,
        nextAction,
        startAudioContext,
        playbackError,
    };
}
