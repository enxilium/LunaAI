import React, { useRef, useState, useEffect } from "react";
import useOrb from "../hooks/useOrb";
import { OrbContainer, AudioWaves, AudioBar } from "../styles/Orb.styles";

const Orb: React.FC = () => {
    const orbRef = useRef<HTMLDivElement>(null);
    const { isListening, isSpeaking, visible, processing } = useOrb();
    
    // Audio visualization state
    const [audioLevels, setAudioLevels] = useState<number[]>([40, 30, 50, 25, 45]);
    const animationRef = useRef<number | null>(null);
    
    // Audio visualization effect
    useEffect(() => {
        if (isSpeaking) {
            // Create an audio visualization effect
            let counter = 0;
            
            const updateVisualization = () => {
                // Generate random bar heights to simulate audio reactivity
                // In a real implementation, you would analyze the actual audio data
                const newLevels = Array(5).fill(0).map(() => 
                    Math.floor(Math.random() * 50) + 20
                );
                
                setAudioLevels(newLevels);
                counter++;
                
                // Continue the animation loop
                animationRef.current = requestAnimationFrame(updateVisualization);
            };
            
            // Start the animation
            animationRef.current = requestAnimationFrame(updateVisualization);
            
            // Clean up
            return () => {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                }
            };
        }
    }, [isSpeaking]);
    
    return (
        <OrbContainer
            ref={orbRef}
            $listening={isListening}
            $visible={visible}
            $processing={processing}
            $speaking={isSpeaking}
            aria-label={
                isListening 
                    ? "Luna is listening" 
                    : processing 
                        ? "Luna is processing" 
                        : isSpeaking
                            ? "Luna is speaking"
                            : "Activate Luna"
            }
        >
            {/* Audio visualization bars */}
            <AudioWaves $active={isSpeaking}>
                {audioLevels.map((height, index) => (
                    <AudioBar key={index} $height={height} />
                ))}
            </AudioWaves>
        </OrbContainer>
    );
};

export default Orb;
