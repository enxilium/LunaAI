import { useState, useEffect } from "react";
import { usePorcupine } from "@picovoice/porcupine-react";
import useError from "./useError";

const KEYWORD_LABEL = "LUNA";

export default function useKeywordDetection(accessKey: string | null) {
    const [keywordPath, setKeywordPath] = useState<string | null>(null);
    const [modelPath, setModelPath] = useState<string | null>(null);
    const { reportError } = useError();

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
            if (accessKey && window.electron?.getAsset) {
                try {
                    console.log("Fetching Porcupine asset paths...");
                    const [fetchedKeywordPath, fetchedModelPath] =
                        await Promise.all([
                            window.electron.getAsset("models", "wakeWord.ppn"),
                            window.electron.getAsset(
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
                    reportError(
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
                reportError(
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
            reportError(`Porcupine error: ${error}`, "useKeywordDetection");
        }
    }, [error, reportError]);

    // Debug log for listening status
    useEffect(() => {
        console.log("Porcupine isListening status:", isListening);
    }, [isListening]);

    return {
        keywordDetection,
        startKeywordDetection: start,
        stopKeywordDetection: stop,
    };
}
