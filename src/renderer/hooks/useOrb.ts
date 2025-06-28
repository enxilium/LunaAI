import { useState, useEffect } from "react";
import useKeywordDetection from "./useKeywordDetection";
import useAudioPlayback from "./useAudioPlayback";

export default function useOrb() {
    const [visible, setVisible] = useState(false);
    const [listeningState, setListeningState] = useState(false); // True means listening
    const [processing, setProcessing] = useState(false);
    const [errorHandling, setErrorHandling] = useState(false);
    const { keywordDetection } = useKeywordDetection();
    const { isPlaying, isFinished, nextAction, startAudioContext } = useAudioPlayback();
    
    useEffect(() => {
        if (keywordDetection) {
            console.log("Keyword detected!");
            setListeningState(true);
            setVisible(true);
            
            window.electron.invoke("start-listening");
            startAudioContext();
        }
    }, [keywordDetection]);

    useEffect(() => {
        // Set up the stop-listening event handler
        window.electron.receive("stop-listening", () => {
            setListeningState(false);

            setTimeout(() => {
                setProcessing(false);
            }, 2000); // Give time for processing animation
        });

        // Clean up listener when component unmounts
        return () => {
            window.electron.removeListener("stop-listening");
        };
    }, []);

    useEffect(() => {
        window.electron.receive("processing", () => {
            console.log("Processing started");
            setProcessing(true);
        });

        window.electron.receive("error-handling", () => {
            console.log("Error handling started");
            setErrorHandling(true);
        });

        // Clean up listener when component unmounts
        return () => {
            console.log("Cleaning up processing listener");
            window.electron.removeListener("processing");
        };
    }, []);

    useEffect(() => {
        if (isPlaying) {
            setProcessing(false);
        }
    }, [isPlaying]);

    useEffect(() => {
        if (isFinished) {
            console.log("Audio playback finished, next action:", nextAction);

            if (nextAction === "conversation-end") {
                window.electron.invoke("hide-orb");
            } else if (nextAction === "processing") {
                setProcessing(true);
            } else if (nextAction === "start-listening") {
                console.log("Starting listening with next action:", nextAction);
                window.electron.invoke("start-listening");
            }
        }
        
    }, [isFinished]);
    
   
    return {
        isListening: listeningState,
        isSpeaking: isPlaying,
        visible,
        processing,
    };
}
