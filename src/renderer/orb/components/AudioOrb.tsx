import React, { useEffect, useRef } from "react";

interface AudioOrbProps {
    color: string;
    isSpeaking?: boolean;
    audioData?: Float32Array | null;
    onDeactivate?: () => void;
}

const AudioOrb: React.FC<AudioOrbProps> = ({
    color,
    isSpeaking = false,
    audioData = null,
    onDeactivate,
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");

        if (!canvas || !ctx) return;

        canvas.width = 300;
        canvas.height = 300;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const baseRadius = 50;

        let time = 0;

        const drawOrb = () => {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Parse color
            const colorMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            const [r, g, b] = colorMatch
                ? [
                      parseInt(colorMatch[1]),
                      parseInt(colorMatch[2]),
                      parseInt(colorMatch[3]),
                  ]
                : [150, 50, 255]; // fallback

            if (isSpeaking) {
                // Enhanced visualization when agent is speaking
                let pulseRadius = baseRadius;

                // Use audio data for visualization if available
                if (audioData && audioData.length > 0) {
                    // Calculate RMS from audio data for intensity
                    let sum = 0;
                    for (let i = 0; i < audioData.length; i++) {
                        sum += audioData[i] * audioData[i];
                    }
                    const rms = Math.sqrt(sum / audioData.length);
                    pulseRadius = baseRadius + rms * 100; // Scale the pulse based on audio
                } else {
                    // Fallback animated pulse when no audio data
                    pulseRadius = baseRadius + Math.sin(time * 0.2) * 15;
                }

                // Create gradient
                const gradient = ctx.createRadialGradient(
                    centerX,
                    centerY,
                    0,
                    centerX,
                    centerY,
                    pulseRadius + 20
                );
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`);
                gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.6)`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.1)`);

                // Draw main orb
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, pulseRadius, 0, 2 * Math.PI);
                ctx.fill();

                // Draw outer glow
                const glowGradient = ctx.createRadialGradient(
                    centerX,
                    centerY,
                    pulseRadius,
                    centerX,
                    centerY,
                    pulseRadius + 40
                );
                glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.4)`);
                glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

                ctx.fillStyle = glowGradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, pulseRadius + 40, 0, 2 * Math.PI);
                ctx.fill();
            } else {
                // Gentle pulsing when listening (not speaking)
                const gentlePulse = baseRadius + Math.sin(time * 0.05) * 5;

                const gradient = ctx.createRadialGradient(
                    centerX,
                    centerY,
                    0,
                    centerX,
                    centerY,
                    gentlePulse + 10
                );
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.6)`);
                gradient.addColorStop(0.8, `rgba(${r}, ${g}, ${b}, 0.3)`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.05)`);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, gentlePulse, 0, 2 * Math.PI);
                ctx.fill();
            }

            time++;
            animationFrameRef.current = requestAnimationFrame(drawOrb);
        };

        drawOrb();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [color, isSpeaking, audioData]);

    const handleClick = () => {
        if (onDeactivate) {
            onDeactivate();
        }
    };

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                width: "100vw",
                cursor: "pointer",
            }}
            onClick={handleClick}
        >
            <canvas ref={canvasRef} />
        </div>
    );
};

export default AudioOrb;
