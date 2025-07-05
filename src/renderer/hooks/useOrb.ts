import { useState, useEffect, useCallback, useRef } from "react";
import useKeywordDetection from "./useKeywordDetection";
import useGemini from "./useGemini";
import useAudio from "./useAudio";
import useError from "./useError";

export default function useOrb() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [picovoiceAccessKey, setPicovoiceAccessKey] = useState<string | null>(
        null
    );
    const [visible, setVisible] = useState(false);
    const [isPendingClose, setIsPendingClose] = useState(false);
    const [finalMessageStarted, setFinalMessageStarted] = useState(false);
    const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { startSession, closeSession, isSpeaking, isSessionActive } =
        useGemini();
    const { isRecording, startRecording, stopRecording } = useAudio();
    const { reportError } = useError();
    const { keywordDetection } = useKeywordDetection(picovoiceAccessKey);

    const resetState = useCallback(() => {
        setIsPendingClose(false);
        setFinalMessageStarted(false);
        if (fallbackTimeoutRef.current) {
            clearTimeout(fallbackTimeoutRef.current);
            fallbackTimeoutRef.current = null;
        }
    }, []);

    const endConversation = useCallback(() => {
        stopRecording();
        setIsPendingClose(true);

        // Set a fallback timeout to force close the session if isSpeaking gets stuck
        if (fallbackTimeoutRef.current) {
            clearTimeout(fallbackTimeoutRef.current);
        }
        fallbackTimeoutRef.current = setTimeout(() => {
            console.log("[useOrb] Fallback timeout: Force closing session");
            closeSession();
            setVisible(false);
            window.electron.send("audio-stream-end");
            resetState();
        }, 10000); // 10 second fallback timeout
    }, [stopRecording, closeSession, resetState]);

    useEffect(() => {
        if (window.electron) {
            window.electron
                .getAsset("key", "picovoice")
                .then((key: string | null) => {
                    setPicovoiceAccessKey(key);
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
        if (isPendingClose && isSpeaking) {
            console.log(
                "[useOrb] Pending close, but still speaking. Waiting for final message..."
            );
            setFinalMessageStarted(true);
        }
    }, [isSpeaking, isPendingClose]);

    useEffect(() => {
        if (finalMessageStarted && !isSpeaking) {
            console.log("[useOrb] Final message completed, closing session...");

            // Clear the fallback timeout since we're closing normally
            if (fallbackTimeoutRef.current) {
                clearTimeout(fallbackTimeoutRef.current);
                fallbackTimeoutRef.current = null;
            }

            closeSession();
            setVisible(false);

            setTimeout(() => {
                window.electron.send("audio-stream-end");
                resetState();
            }, 1000);
        }
    }, [isSpeaking, finalMessageStarted, closeSession, resetState]);

    useEffect(() => {
        if (keywordDetection && !isRecording && !isSessionActive) {
            setVisible(true);
            window.electron.send("show-orb");

            startSession().then((success) => {
                if (success) {
                    startRecording();
                }
            });
        }
    }, [keywordDetection, startSession, startRecording]);

    useEffect(() => {
        window.electron.receive("end-conversation", endConversation);

        return () => {
            window.electron.removeListener("end-conversation");
        };
    }, [endConversation]);

    // Debug logging for isSpeaking state
    useEffect(() => {
        console.log(`[useOrb] isSpeaking state changed: ${isSpeaking}`);
    }, [isSpeaking]);

    return {
        isListening: isRecording,
        isSpeaking,
        visible,
        processing: isProcessing,
    };
}
