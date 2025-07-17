import React, { useEffect, useRef } from "react";
import {
    useVoiceAssistant,
    useMultibandTrackVolume,
} from "@livekit/components-react";

interface AudioOrbProps {
    color: string;
}

const AudioOrb: React.FC<AudioOrbProps> = ({ color }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Get the agent's audio track and state from LiveKit
    const { audioTrack, state } = useVoiceAssistant();

    // Get real-time volume data from the audio track
    const volumeBands = useMultibandTrackVolume(audioTrack, {
        bands: 25, // Use 15 bands for more detailed visualization
    });

    // Debug logging
    useEffect(() => {
        if (volumeBands.length > 0) {
            console.log(
                "[AudioOrb] Volume bands:",
                volumeBands.map((v) => v.toFixed(3))
            );
        }
    }, [volumeBands]); // Remove volumeBands from dependencies to reduce logging

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");

        if (!canvas || !ctx) return;

        canvas.width = 300;
        canvas.height = 300;

        const drawCircle = (
            x: number,
            y: number,
            radius: number,
            fillStyle: string,
            shadowBlur: number = 10,
            shadowColor: string = fillStyle
        ) => {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = fillStyle;
            ctx.shadowBlur = shadowBlur;
            ctx.shadowColor = shadowColor;
            ctx.fill();
        };

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);

            const scaledBands = volumeBands.map((v) => v * 255); // Scale to 0-255 range

            const lowFreqs = scaledBands.slice(0, 8); // First 8 bands (low frequencies)
            const highFreqs = scaledBands.slice(8, 17); // Next 9 bands (high frequencies)

            const avgLow =
                lowFreqs.length > 0
                    ? lowFreqs.reduce((a, b) => a + b, 0) / lowFreqs.length
                    : 0;
            const avgHigh =
                highFreqs.length > 0
                    ? highFreqs.reduce((a, b) => a + b, 0) / highFreqs.length
                    : 0;

            const pulseLow = avgLow / 255; // Normalize back to 0-1
            const pulseHigh = avgHigh / 255; // Normalize back to 0-1

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw based on state with volume reactivity
            if (state !== "disconnected" && state !== "connecting") {
                // Main orb elements - using the same structure as your AudioContext version
                drawCircle(150, 150 + pulseLow * 30, 20 + pulseLow * 5, color);
                drawCircle(
                    150 + pulseLow * 20,
                    150 + pulseLow * 20,
                    5 + pulseLow * 20,
                    color
                );
                drawCircle(
                    150 - pulseLow * 20,
                    150 + pulseLow * 20,
                    5 + pulseLow * 20,
                    color
                );

                drawCircle(
                    150,
                    150 - pulseHigh * 20,
                    20 + pulseHigh * 5,
                    color
                );
                drawCircle(
                    150 - pulseHigh * 20,
                    150 - pulseHigh * 10,
                    5 + pulseHigh * 10,
                    color
                );
                drawCircle(
                    150 + pulseHigh * 20,
                    150 - pulseHigh * 10,
                    5 + pulseHigh * 10,
                    color
                );

                // Core orb
                drawCircle(
                    150,
                    150,
                    40 + pulseLow * 10,
                    color,
                    20 + pulseLow * 10
                );
                drawCircle(
                    150,
                    150,
                    20 + pulseHigh * 15,
                    "rgba(200, 120, 255,0.5)",
                    10,
                    "white"
                );
            } else {
                // Static orb when disconnected
                drawCircle(150, 150, 40, color, 20);
                drawCircle(
                    150,
                    150,
                    20,
                    "rgba(200, 120, 255,0.5)",
                    10,
                    "white"
                );
            }
        };

        draw();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [color, state, volumeBands]); // Re-run when state or volume changes

    return (
        <div className="relative">
            <canvas
                ref={canvasRef}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            />
        </div>
    );
};

export default AudioOrb;
