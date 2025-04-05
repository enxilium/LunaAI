// src/components/useOrb.ts
import { useState, useCallback, useEffect } from "react";

const useOrb = () => {
    const [isListening, setIsListening] = useState(false);

    const toggleListening = useCallback(() => {
        const newState = !isListening;
        setIsListening(newState);

        // Send command to Electron main process
        if (window.electron) {
            window.electron.send({command: newState ? "start-listen" : "stop-listen", args: {}});
        }
    }, [isListening]);

    // Listen for responses from the system
    useEffect(() => {
        if (window.electron) {
            window.electron.receive("system-response", (message) => {
                console.log("System response:", message);
                // You could update state based on message
            });

            window.electron.receive("error-response", (message) => {
                console.error("Error:", message);
            });
        }

        return () => {
            // Cleanup if needed
        };
    }, []);

    return { isListening, toggleListening };
};

export default useOrb;
