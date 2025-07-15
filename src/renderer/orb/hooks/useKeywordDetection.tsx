import { useState, useEffect, useRef } from "react";
import { usePorcupine } from "@picovoice/porcupine-react";

const KEYWORD_LABEL = "LUNA";

export default function useKeywordDetection(accessKey: string | null) {
    const initializingRef = useRef(false);

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

    // Initialize Porcupine when access key is available
    useEffect(() => {
        if (!accessKey || initializingRef.current) {
            return;
        }

        const initPorcupine = async () => {
            try {
                initializingRef.current = true;

                if (isLoaded) {
                    await release();
                }

                // Use require to import model files at runtime
                const wakeWordModelPath = require("../public/models/wakeWord.ppn");
                const porcupineParamsPath = require("../public/models/porcupine_params.pv");

                const porcupineKeyword = {
                    publicPath: wakeWordModelPath.default || wakeWordModelPath,
                    label: KEYWORD_LABEL,
                };

                const porcupineModel = {
                    publicPath:
                        porcupineParamsPath.default || porcupineParamsPath,
                };

                await init(accessKey, porcupineKeyword, porcupineModel);
                await start();

                console.log("[Keyword] Activated, listening for wake word...");
            } catch (error) {
                window.electron.reportError(
                    `Failed to initialize Porcupine: ${error}`,
                    "useKeywordDetection"
                );
            } finally {
                initializingRef.current = false;
            }
        };

        initPorcupine();

        // Cleanup when component unmounts or accessKey changes
        return () => {
            initializingRef.current = false;
            if (isListening) {
                stop();
            }
            if (isLoaded) {
                release();
            }
        };
    }, [accessKey]);

    // If porcupine encounters errors, report them
    useEffect(() => {
        if (error) {
            // Report the error to the main process
            window.electron.reportError(
                `Porcupine error: ${error}`,
                "useKeywordDetection"
            );
        }
    }, [error]);

    return {
        keywordDetection,
        isListening,
        startKeywordDetection: start,
        stopKeywordDetection: stop,
    };
}
