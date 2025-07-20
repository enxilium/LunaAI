import React, { useEffect, useRef } from "react";

interface AudioOrbProps {
    color: string;
    isActive?: boolean;
    onDeactivate?: () => void;
}

const AudioOrb: React.FC<AudioOrbProps> = ({
    color,
    isActive = false,
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

            if (isActive) {
                // Animated pulsing effect when active
                const pulseRadius = baseRadius + Math.sin(time * 0.1) * 10;

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
                gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.4)`);
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
                    pulseRadius + 30
                );
                glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`);
                glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

                ctx.fillStyle = glowGradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, pulseRadius + 30, 0, 2 * Math.PI);
                ctx.fill();
            } else {
                // Static orb when inactive
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
                ctx.beginPath();
                ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
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
    }, [color, isActive]);

    const handleClick = () => {
        if (isActive && onDeactivate) {
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
                cursor: isActive ? "pointer" : "default",
            }}
            onClick={handleClick}
        >
            <canvas ref={canvasRef} />
        </div>
    );
};

export default AudioOrb;
