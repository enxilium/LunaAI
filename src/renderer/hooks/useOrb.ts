import { useState, useEffect, useCallback, useRef } from "react";
import useKeywordDetection from "./useKeywordDetection";
import useGemini from "./useGemini";
import useAudio from "./useAudio";
import useError from "./useError";

export default function useOrb() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
    const [picovoiceAccessKey, setPicovoiceAccessKey] = useState<string | null>(
        null
    );
    const [visible, setVisible] = useState(false);
    const [isPendingClose, setIsPendingClose] = useState(false);
    const [finalMessageStarted, setFinalMessageStarted] = useState(false);
    const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

    const {
        startSession,
        closeSession,
        isSpeaking,
    } = useGemini(geminiApiKey);

    const { isRecording, startRecording, stopRecording } = useAudio();
    const { reportError } = useError();
    const { keywordDetection } = useKeywordDetection(picovoiceAccessKey);

    // Reset function to prepare for a new session
    const resetState = useCallback(() => {
        setIsPendingClose(false);
        setFinalMessageStarted(false);
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    }, []);

    const endConversation = useCallback(() => {
        console.log("Ending conversation...");
        stopRecording();
        setIsPendingClose(true);
    }, [stopRecording]);

    // Get API keys
    useEffect(() => {
        if (window.electron) {
            window.electron
                .getAsset("key", "gemini")
                .then((key: string | null) => {
                    setGeminiApiKey(key);
                    console.log("Received Gemini API key");
                })
                .catch((err: Error) =>
                    reportError(
                        `Failed to get Gemini API Key: ${err.message}`,
                        "useOrb"
                    )
                );

            window.electron
                .getAsset("key", "picovoice")
                .then((key: string | null) => {
                    setPicovoiceAccessKey(key);
                    console.log("Received Picovoice access key");
                })
                .catch((err: Error) =>
                    reportError(
                        `Failed to get Picovoice Access Key: ${err.message}`,
                        "useOrb"
                    )
                );
        }
    }, [reportError]);

    useEffect(() => {
        console.log("isSpeaking state", isSpeaking);
        if (isPendingClose && isSpeaking) {
            setFinalMessageStarted(true);
        }

    }, [isSpeaking])

    useEffect(() => {
        if (finalMessageStarted && !isSpeaking) {
            closeSession();
            setVisible(false);

            setTimeout(() => {
                window.electron.send("audio-stream-end");
                resetState();
            }, 1000);
        }
    }, [isSpeaking, closeSession, resetState]);

    useEffect(() => {
        if (keywordDetection && !isRecording) {
            console.log("Keyword detected!");

            setVisible(true);
            window.electron.send("show-orb");

            startSession().then((newSession) => {
                startRecording((audioData: string) => {
                    newSession?.sendRealtimeInput({
                        audio: {
                            data: audioData,
                            mimeType: "audio/pcm;rate=16000",
                        },
                    });
                });
            });
        }
    }, [keywordDetection, startSession, startRecording]);

    useEffect(() => {
        window.electron.receive("end-conversation", endConversation);

        return () => {
            window.electron.removeListener("end-conversation");
        };
    }, [endConversation]);

    return {
        isListening: isRecording,
        isSpeaking,
        visible,
        processing: isProcessing,
    };
}
