import { useState, useEffect } from "react";
import { usePorcupine } from "@picovoice/porcupine-react";

const KEYWORD_LABEL = "LUNA";

export default function useKeywordDetection(accessKey: string | null) {
    const [keywordPath, setKeywordPath] = useState<string | null>(null);
    const [modelPath, setModelPath] = useState<string | null>(null);
    const [isKeywordDetected, setIsKeywordDetected] = useState(false);

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

    // Monitor keyword detection changes
    useEffect(() => {
        if (keywordDetection) {
            // Check if the detected keyword matches our wake word
            if (keywordDetection.label === KEYWORD_LABEL) {
                setIsKeywordDetected(true);

                // Reset detection flag after 2 seconds
                setTimeout(() => {
                    setIsKeywordDetected(false);
                }, 2000);
            }
        }
    }, [keywordDetection]);

    useEffect(() => {
        const fetchPaths = async () => {
            if (accessKey && window.electron?.getAsset) {
                try {
                    const [fetchedKeywordPath, fetchedModelPath] =
                        await Promise.all([
                            window.electron.getAsset("models", "wakeWord.ppn"),
                            window.electron.getAsset(
                                "models",
                                "porcupine_params.pv"
                            ),
                        ]);

                    setKeywordPath(fetchedKeywordPath);
                    setModelPath(fetchedModelPath);
                } catch (error) {
                    window.electron.reportError(
                        `Failed to get Porcupine asset paths: ${error}`,
                        "useKeywordDetection"
                    );
                }
            } else if (accessKey) {
                console.log(
                    "window.electron.getAsset not available yet, waiting..."
                );
            }
        };

        fetchPaths();
    }, [accessKey, reportError]);

    // Initialize Porcupine when access key and paths are available
    useEffect(() => {
        if (!accessKey || !keywordPath || !modelPath) {
            return;
        }

        const initPorcupine = async () => {
            try {
                if (isLoaded) {
                    await release();
                }

                const porcupineKeyword = {
                    publicPath: keywordPath,
                    label: KEYWORD_LABEL,
                };

                const porcupineModel = {
                    publicPath: modelPath,
                };

                await init(accessKey, porcupineKeyword, porcupineModel);
                await start();

                console.log("[Wake Word] Wake word detection initialized.");
            } catch (err) {
                window.electron.reportError(
                    `Failed to initialize Porcupine: ${err}`,
                    "useKeywordDetection"
                );
            }
        };

        initPorcupine();

        // Cleanup when component unmounts
        return () => {
            if (isListening) {
                stop();
            }
            if (isLoaded) {
                release();
            }
        };
    }, [accessKey, keywordPath, modelPath]);

    // If porcupine encounters errors, log them
    useEffect(() => {
        if (error) {
            window.electron.reportError(
                `Porcupine error: ${error}`,
                "useKeywordDetection"
            );
        }
    }, [error]);


    return {
        keywordDetection,
        isListening,
        isKeywordDetected,
        startKeywordDetection: start,
        stopKeywordDetection: stop,
    };
}
