import { useState, useEffect, useRef } from "react";
import useKeywordDetection from "./useKeywordDetection";
import useAudioPlayback from "./useAudioPlayback";
import {
    GoogleGenAI,
    Modality,
    Session,
    LiveServerMessage,
} from "@google/genai";
import { Buffer } from "buffer";

export default function useOrb() {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [conversationEnded, setConversationEnded] = useState(true);
    const [dots, setDots] = useState([]);
    const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
    const picovoiceAccessKey = process.env.PICOVOICE_ACCESS_KEY || null;
    const [visible, setVisible] = useState(false);
    const [errorHandling, setErrorHandling] = useState(false);

    useEffect(() => {
        if (window.electron) {
            // Get Gemini API key
            window.electron
                .invoke("get-gemini-key")
                .then((key) => {
                    setGeminiApiKey(key);
                    console.log("Received Gemini API key");
                })
                .catch((err) =>
                    console.error("Failed to get Gemini API key:", err)
                );
        }
    }, []);

    const { keywordDetection } = useKeywordDetection(picovoiceAccessKey);
    const { isPlaying, isFinished, nextAction, startAudioContext } =
        useAudioPlayback();
    const audioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(
        null
    );
    const clientRef = useRef<GoogleGenAI | null>(null);
    const sessionRef = useRef<Session | null>(null);
    const nextStartTimeRef = useRef(0);
    const isListeningRef = useRef(isListening);
    isListeningRef.current = isListening;

    const playAudioChunk = async (audioData: string) => {
        console.log("playAudioChunk called");
        if (!outputAudioContextRef.current) {
            outputAudioContextRef.current = new AudioContext({
                sampleRate: 24000,
            });
            nextStartTimeRef.current =
                outputAudioContextRef.current.currentTime;
        }

        try {
            const audioContext = outputAudioContextRef.current;
            // 1. Decode base64 and create Int16Array
            const buffer = Buffer.from(audioData, "base64");
            const pcm16Data = new Int16Array(
                buffer.buffer,
                buffer.byteOffset,
                buffer.byteLength / Int16Array.BYTES_PER_ELEMENT
            );

            // 2. Convert to Float32
            const pcm32Data = new Float32Array(pcm16Data.length);
            for (let i = 0; i < pcm16Data.length; i++) {
                pcm32Data[i] = pcm16Data[i] / 32768;
            }

            // 3. Create AudioBuffer and copy data
            const audioBuffer = audioContext.createBuffer(
                1,
                pcm32Data.length,
                24000
            );
            audioBuffer.getChannelData(0).set(pcm32Data);

            // 4. Play buffer with scheduling
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);

            const currentTime = audioContext.currentTime;
            const startTime = Math.max(currentTime, nextStartTimeRef.current);

            source.start(startTime);
            console.log(`Audio chunk scheduled for: ${startTime}`);

            nextStartTimeRef.current = startTime + audioBuffer.duration;
        } catch (e) {
            console.error("Error playing audio chunk:", e);
        }
    };

    const startGeminiSession = async () => {
        if (!geminiApiKey) {
            console.error("Gemini API key not available.");
            return;
        }

        if (!clientRef.current) {
            clientRef.current = new GoogleGenAI({ apiKey: geminiApiKey });
        }

        try {
            sessionRef.current = await clientRef.current.live.connect({
                model: "gemini-live-2.5-flash-preview",
                callbacks: {
                    onopen: () => console.log("Gemini session opened."),
                    onmessage: async (message: LiveServerMessage) => {
                        console.log("Received message from Gemini:", message);
                        const audio =
                            message.serverContent?.modelTurn?.parts?.[0]
                                ?.inlineData;
                        if (audio?.data) {
                            console.log("Received audio chunk from Gemini.");
                            await playAudioChunk(audio.data);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error("Gemini session error:", e.message);
                        setErrorHandling(true);
                    },
                    onclose: (e: CloseEvent) => {
                        console.log("Gemini session closed:", e.reason);
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction:
                        "You are a helpful assistant and answer in a friendly tone.",
                },
            });
        } catch (e) {
            console.error("Failed to connect to Gemini Live API:", e);
            setErrorHandling(true);
        }
    };

    const startRecording = async () => {
        console.log("useOrb: Starting recording...");
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext({
                    sampleRate: 16000,
                });
            }
            if (audioContextRef.current.state === "suspended") {
                await audioContextRef.current.resume();
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            mediaStreamRef.current = stream;

            mediaStreamSourceRef.current =
                audioContextRef.current.createMediaStreamSource(stream);

            const bufferSize = 4096;
            scriptProcessorNodeRef.current =
                audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);

            scriptProcessorNodeRef.current.onaudioprocess = (
                event: AudioProcessingEvent
            ) => {
                if (sessionRef.current && isListeningRef.current) {
                    console.log("Sending audio data to Gemini.");
                    const float32Data = event.inputBuffer.getChannelData(0);

                    // Convert Float32 to Int16
                    const int16Data = new Int16Array(float32Data.length);
                    for (let i = 0; i < float32Data.length; i++) {
                        int16Data[i] =
                            Math.max(-1, Math.min(1, float32Data[i])) * 32767;
                    }

                    const base64 = Buffer.from(int16Data.buffer).toString(
                        "base64"
                    );
                    sessionRef.current.sendRealtimeInput({
                        audio: {
                            data: base64,
                            mimeType: "audio/pcm;rate=16000",
                        },
                    });
                }
            };

            mediaStreamSourceRef.current.connect(
                scriptProcessorNodeRef.current
            );
            scriptProcessorNodeRef.current.connect(
                audioContextRef.current.destination
            );
        } catch (error) {
            console.error("useOrb: Error starting recording:", error);
        }
    };

    const stopRecording = () => {
        console.log("stopRecording called.");

        // Disconnect ScriptProcessorNode
        if (scriptProcessorNodeRef.current) {
            scriptProcessorNodeRef.current.disconnect();
            scriptProcessorNodeRef.current.onaudioprocess = null; // Remove callback
            scriptProcessorNodeRef.current = null;
        }

        // Disconnect the audio source BEFORE closing the session
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current
                .getTracks()
                .forEach((track: MediaStreamTrack) => track.stop());
            mediaStreamRef.current = null;
        }

        // Now, close the session
        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
        }

        setIsListening(false);
    };

    useEffect(() => {
        if (keywordDetection) {
            console.log("Keyword detected!");
            setIsListening(true);
            setVisible(true);

            window.electron.invoke("start-listening");
            startAudioContext(); // For playback
            startGeminiSession().then(() => {
                startRecording();
            });
        }
    }, [keywordDetection]);

    useEffect(() => {
        // Set up the stop-listening event handler
        window.electron.receive("stop-listening", () => {
            stopRecording();

            setTimeout(() => {
                setIsProcessing(false);
            }, 2000); // Give time for processing animation
        });

        // Clean up listener when component unmounts
        return () => {
            window.electron.removeListener("stop-listening");
            stopRecording();
        };
    }, []);

    useEffect(() => {
        window.electron.receive("processing", () => {
            console.log("Processing started");
            setIsProcessing(true);
        });

        window.electron.receive("error-handling", () => {
            console.log("Error handling started");
            setErrorHandling(true);
        });

        // Clean up listener when component unmounts
        return () => {
            console.log("Cleaning up processing listener");
            window.electron.removeListener("processing");
        };
    }, []);

    useEffect(() => {
        if (isPlaying) {
            setIsProcessing(false);
        }
    }, [isPlaying]);

    useEffect(() => {
        if (isFinished) {
            console.log("Audio playback finished, next action:", nextAction);

            if (nextAction === "conversation-end") {
                window.electron.invoke("hide-orb");
                setVisible(false);
            } else if (nextAction === "processing") {
                setIsProcessing(true);
            } else if (nextAction === "start-listening") {
                console.log("Starting listening with next action:", nextAction);
                window.electron.invoke("start-listening");
                startRecording();
            }
        }
    }, [isFinished, nextAction]);

    return {
        isListening: isListening,
        isSpeaking: isPlaying,
        visible,
        processing: isProcessing,
    };
}
