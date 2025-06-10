import { useState, useEffect } from "react";
import useKeywordDetection from "./useKeywordDetection";
import useAudioPlayback from "./useAudioPlayback";

export default function useOrb() {
    const [visible, setVisible] = useState(false);
    const [listeningState, setListeningState] = useState(false); // True means listening
    const [processingTranscription, setProcessingTranscription] = useState(false);
    const { keywordDetection } = useKeywordDetection();
    const { isPlaying, isInitialized, startAudioContext } = useAudioPlayback();

    // For debugging
    useEffect(() => {
        console.log("useOrb state:", { visible, listeningState });
    }, [visible, listeningState]);

    useEffect(() => {
        if (keywordDetection) {
            console.log("Keyword detected!");
            setListeningState(true);
            setVisible(true);

            window.electron.invoke("start-listening")
            startAudioContext();
        }
    }, [keywordDetection]);
    
    // Monitor listening state to control audio recording
    useEffect(() => {
        if (listeningState) {
            console.log("Starting renderer-based audio recording");
            setProcessingTranscription(false);
        } else if (!listeningState) {
            console.log("Stopping renderer-based audio recording");
            // This is where we shift to the processing state
            setProcessingTranscription(true);
        }
    }, [listeningState]);
    
    return {
        isListening: listeningState,
        visible,
        processingTranscription,
    };
}
