import React, { useRef } from "react";
import useOrb from "../hooks/useOrb";
import { OrbContainer } from "../styles/Orb.styles";

const Orb: React.FC = () => {
    const orbRef = useRef<HTMLDivElement>(null);
    const { isListening, visible, processingTranscription } = useOrb();
    
    return (
        <OrbContainer
            ref={orbRef}
            $listening={isListening}
            $visible={visible}
            $processing={processingTranscription}
            aria-label={
                isListening 
                    ? "Luna is listening" 
                    : processingTranscription 
                        ? "Luna is processing" 
                        : "Activate Luna"
            }
        />
    );
};

export default Orb;
