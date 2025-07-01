import { useState, useEffect, useCallback } from "react";
import useKeywordDetection from "./useKeywordDetection";
import useGemini from "./useGemini";
import useAudio from "./useAudio";
import useError from "./useError";

export default function useOrb() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
    const [picovoiceAccessKey, setPicovoiceAccessKey] = useState<string | null>(null);
    const [visible, setVisible] = useState(false);

    const { startSession, closeSession, isSpeaking } = useGemini(geminiApiKey);

    const { isRecording, startRecording, stopRecording } = useAudio();
    const { reportError } = useError();
    const { keywordDetection } = useKeywordDetection(picovoiceAccessKey);

    const endConversation = useCallback(() => {
        stopRecording();
        closeSession();
    }, [stopRecording, closeSession]);

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
    }, [keywordDetection, startSession, startRecording, isRecording]);

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
