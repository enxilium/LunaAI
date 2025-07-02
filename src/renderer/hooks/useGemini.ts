import { useState, useRef, useCallback, useEffect } from "react";
import useAudio from "./useAudio";
import useError from "./useError";

/**
 * @description Custom hook for managing the Gemini session.
 * @returns {{
 *  isSessionActive: boolean;
 *  startSession: () => Promise<boolean>;
 *  closeSession: () => void;
 *  isSpeaking: boolean;
 *  isInterrupted: boolean;
 *  isProcessingToolResponse: boolean;
 * }}
 */
export default function useGemini() {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isInterrupted, setIsInterrupted] = useState(false);
    const [isProcessingToolResponse, setIsProcessingToolResponse] =
        useState(false);
    const { playAudio, isPlaying: isSpeaking, stopAudio } = useAudio();
    const { reportError } = useError();
    const isSessionActiveRef = useRef(isSessionActive);
    isSessionActiveRef.current = isSessionActive;

    const startSession = useCallback(async () => {
        try {
            const result = await window.electron.invoke("gemini:start-session");
            if (result.success) {
                setIsSessionActive(true);
                return true;
            } else {
                reportError(
                    `Failed to start Gemini session: ${result.error}`,
                    "useGemini"
                );
                return false;
            }
        } catch (error) {
            reportError(
                `Failed to start Gemini session: ${(error as Error).message}`,
                "useGemini"
            );
            return false;
        }
    }, [reportError]);

    const closeSession = useCallback(() => {
        if (isSessionActiveRef.current) {
            window.electron.invoke("gemini:close-session");
            setIsSessionActive(false);
            stopAudio();
            setIsProcessingToolResponse(false);
        }
    }, [stopAudio]);

    useEffect(() => {
        const handleAudioChunk = (audioData: string) => {
            playAudio(audioData).catch((err) =>
                console.error("Audio playback error:", err)
            );
        };

        const handleInterrupted = () => {
            console.log("Gemini session interrupted in renderer.");
            setIsInterrupted(true);
            stopAudio();
        };

        const handleSessionOpened = () => {
            console.log("Gemini session opened in renderer.");
            setIsInterrupted(false);
        };

        const handleError = (errorMessage: string) => {
            reportError(`Gemini error: ${errorMessage}`, "useGemini");
        };

        const handleClosed = (reason: string) => {
            console.log("Gemini session closed in renderer:", reason);
            setIsSessionActive(false);
        };

        window.electron.receive("gemini:audio-chunk", handleAudioChunk);
        window.electron.receive("gemini:interrupted", handleInterrupted);
        window.electron.receive("gemini:session-opened", handleSessionOpened);
        window.electron.receive("gemini:error", handleError);
        window.electron.receive("gemini:closed", handleClosed);

        return () => {
            window.electron.removeListener("gemini:audio-chunk");
            window.electron.removeListener("gemini:interrupted");
            window.electron.removeListener("gemini:session-opened");
            window.electron.removeListener("gemini:error");
            window.electron.removeListener("gemini:closed");
        };
    }, [playAudio, stopAudio, reportError]);

    return {
        isSessionActive,
        startSession,
        closeSession,
        isSpeaking,
        isInterrupted,
        isProcessingToolResponse,
    };
}
