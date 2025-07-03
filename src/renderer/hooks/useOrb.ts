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

    const { startSession, closeSession, isSpeaking, isSessionActive } =
        useGemini();
    const { isRecording, startRecording, stopRecording } = useAudio();
    const { reportError } = useError();
    const { keywordDetection } = useKeywordDetection(picovoiceAccessKey);

    const resetState = useCallback(() => {
        setIsPendingClose(false);
        setFinalMessageStarted(false);
    }, []);

    const endConversation = useCallback(() => {
        console.log("Ending conversation...");
        stopRecording();
        setIsPendingClose(true);
    }, [stopRecording]);

    useEffect(() => {
        if (window.electron) {
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
    }, [isSpeaking, isPendingClose]);

    useEffect(() => {
        if (finalMessageStarted && !isSpeaking) {
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
            console.log("Keyword detected!");

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

    return {
        isListening: isRecording,
        isSpeaking,
        visible,
        processing: isProcessing,
    };
}
