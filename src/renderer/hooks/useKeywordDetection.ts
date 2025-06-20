import { useState, useEffect, useCallback } from "react";
import { usePorcupine } from "@picovoice/porcupine-react";

// Define model file names
const KEYWORD_FILE_NAME = "assets/models/wakeWord.ppn";
const MODEL_FILE_NAME = "assets/models/porcupine_params.pv";
const KEYWORD_LABEL = "LUNA";

export default function useKeywordDetection() {
    const [accessKey, setAccessKey] = useState("");

    const {
        keywordDetection,
        isLoaded,
        isListening,
        error,
        init,
        start,
        stop,
        release,
    } = usePorcupine();

    // Get Picovoice access key from main process
    useEffect(() => {
        if (window.electron?.invoke) {
            window.electron
                .invoke("get-picovoice-key")
                .then((key) => {
                    setAccessKey(key);
                    console.log("Received Picovoice access key");
                })
                .catch((err) =>
                    console.error("Failed to get Picovoice access key:", err)
                );
        }
    }, []);

    // Initialize Porcupine when access key is available
    useEffect(() => {
        // Only proceed if we have the access key
        if (!accessKey) return;

        const initPorcupine = async () => {
            try {
                console.log("Loading model files from:", {
                    keyword: KEYWORD_FILE_NAME,
                    model: MODEL_FILE_NAME,
                });

                const porcupineKeyword = {
                    publicPath: KEYWORD_FILE_NAME,
                    label: KEYWORD_LABEL,
                };

                const porcupineModel = {
                    publicPath: MODEL_FILE_NAME,
                };

                await init(accessKey, porcupineKeyword, porcupineModel).then(() => {
                    console.log("Porcupine initialized successfully");
                    start();
                });
                console.log("Wake word detection initialized and started");
            } catch (err) {
                console.error("Failed to initialize Porcupine:", err);
            }
        };

        initPorcupine();

        // Cleanup when component unmounts
        return () => {
            if (isListening) {
                stop();
            }
            release();
        };
    }, [accessKey, KEYWORD_FILE_NAME, MODEL_FILE_NAME]);

    // If porcupine encounters errors, log them
    useEffect(() => {
        if (error) {
            console.error("Porcupine error:", error);
        }
    }, [error]);

    return {
        keywordDetection
    };
}
