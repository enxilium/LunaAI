import { useState, useEffect } from "react";
import { usePorcupine } from "@picovoice/porcupine-react";

const KEYWORD_LABEL = "LUNA";

export default function useKeywordDetection(accessKey: string | null) {
    const [keywordPath, setKeywordPath] = useState<string | null>(null);
    const [modelPath, setModelPath] = useState<string | null>(null);

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

    useEffect(() => {
        const fetchPaths = async () => {
            if (accessKey && window.electron?.getAssetPath) {
                try {
                    console.log("Fetching Porcupine asset paths...");
                    const [fetchedKeywordPath, fetchedModelPath] =
                        await Promise.all([
                            window.electron.getAssetPath(
                                "models",
                                "wakeWord.ppn"
                            ),
                            window.electron.getAssetPath(
                                "models",
                                "porcupine_params.pv"
                            ),
                        ]);

                    console.log(
                        "Porcupine paths fetched:",
                        fetchedKeywordPath,
                        fetchedModelPath
                    );

                    setKeywordPath(fetchedKeywordPath);
                    setModelPath(fetchedModelPath);
                } catch (error) {
                    console.error(
                        "Failed to get Porcupine asset paths:",
                        error
                    );
                }
            } else if (accessKey) {
                console.warn("window.electron.getAssetPath not available yet.");
            }
        };

        fetchPaths();
    }, [accessKey]);

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

                console.log("Initializing Porcupine...");
                const porcupineKeyword = {
                    publicPath: keywordPath,
                    label: KEYWORD_LABEL,
                };

                const porcupineModel = {
                    publicPath: modelPath,
                };

                await init(accessKey, porcupineKeyword, porcupineModel);
                console.log("Porcupine initialized, starting...");
                start();
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
            if (isLoaded) {
                release();
            }
        };
    }, [accessKey, keywordPath, modelPath]);

    // If porcupine encounters errors, log them
    useEffect(() => {
        if (error) {
            console.error("Porcupine error:", error);
        }
    }, [error]);

    useEffect(() => {
        console.log("Porcupine isListening status:", isListening);
    }, [isListening]);

    useEffect(() => {
        if (keywordDetection) {
            console.log("Keyword detected in hook:", keywordDetection);
        }
    }, [keywordDetection]);

    return {
        keywordDetection,
    };
}
