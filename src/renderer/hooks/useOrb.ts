import { useState, useEffect } from "react";
import useKeywordDetection from "./useKeywordDetection";
import useAudioPlayback from "./useAudioPlayback";

export default function useOrb() {
    const [visible, setVisible] = useState(false);
    const [listeningState, setListeningState] = useState(false); // True means listening
    const [processing, setProcessing] = useState(false);
    const { keywordDetection } = useKeywordDetection();
    const { isPlaying, isFinished, conversationEnd, startAudioContext } = useAudioPlayback();

    useEffect(() => {
        if (keywordDetection) {
            console.log("Keyword detected!");
            setListeningState(true);
            setVisible(true);

            window.electron.setupAudioListeners();

            window.electron.invoke("start-listening")

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
            setProcessing(true);
        });
    }, []);

    useEffect(() => {
        if (isPlaying) {
            setProcessing(false);
        }
    }, [isPlaying]);

    useEffect(() => {
        if (isFinished) {
            console.log("Audio playback finished, conversationEnd:", conversationEnd);

            if (conversationEnd) {
                window.electron.invoke("hide-orb");
            } else {
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
