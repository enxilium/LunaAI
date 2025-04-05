import React, { useRef, useEffect } from "react";
import { OrbContainer } from "./Orb.styles";
import useOrb from "../hooks/useOrb";

const Orb: React.FC = () => {
    const { isListening, toggleListening } = useOrb();
    const isSpeaking = false; // Placeholder for speaking state
    const orbRef = useRef<HTMLDivElement>(null);

    // Track size changes and send updates to main process
    useEffect(() => {
        if (!orbRef.current || !window.electron) return;

        let animationFrameId: number;
        let lastWidth = 0;
        let lastHeight = 0;
        let lastUpdateTime = 0;

        const updateSize = () => {
            if (orbRef.current) {
                const now = Date.now();
                // Increase throttle to every 200ms to reduce update frequency
                if (now - lastUpdateTime > 200) {
                    const rect = orbRef.current.getBoundingClientRect();

                    // Only send updates when size changes by at least 2px
                    if (
                        Math.abs(rect.width - lastWidth) > 2 ||
                        Math.abs(rect.height - lastHeight) > 2
                    ) {
                        lastWidth = rect.width;
                        lastHeight = rect.height;
                        lastUpdateTime = now;

                        // Add padding to ensure we capture the full effect including shadow
                        const padding = isListening ? 30 : 20;

                        window.electron.send({
                            command: "update-orb-size",
                            args: {
                                width: Math.ceil(rect.width) + padding,
                                height: Math.ceil(rect.height) + padding,
                            },
                        });
                    }
                }

                // Continue the animation frame loop
                animationFrameId = requestAnimationFrame(updateSize);
            }
        };

        // Start the update loop
        updateSize();

        // Clean up
        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [isListening]);

    return (
        <OrbContainer
            ref={orbRef}
            $listening={isListening}
            onClick={toggleListening}
            aria-label={
                isListening
                    ? "Luna is listening"
                    : isSpeaking
                    ? "Luna is speaking"
                    : "Activate Luna"
            }
        />
    );
};

export default Orb;
