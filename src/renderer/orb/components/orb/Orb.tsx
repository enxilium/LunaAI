import React, { useState, useEffect } from "react";
import styled from "styled-components";
import {
    Orb as ReactAiOrb,
    emeraldPreset,
    goldenGlowPreset,
    galaxyPreset,
    oceanDepthsPreset,
} from "react-ai-orb";
import {
    useLocalParticipant,
    useSpeakingParticipants,
    useRemoteParticipants,
} from "@livekit/components-react";

const OrbWrapper = styled.div`
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    background: transparent;
    overflow: hidden;
`;

const OrbContainer = styled.div`
    position: relative;
    width: 200px;
    height: 200px;
    cursor: pointer;
    transition: all 0.3s ease;
    -webkit-app-region: drag;
    -webkit-user-select: none;

    &:hover {
        transform: scale(1.05);
    }
`;

type OrbState = "idle" | "listening" | "thinking" | "speaking";

const Orb: React.FC = () => {
    const [orbState, setOrbState] = useState<OrbState>("idle");
    const [showPanel, setShowPanel] = useState(false);
    const [panelCollapsed, setPanelCollapsed] = useState(true);

    const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
    const speakingParticipants = useSpeakingParticipants();
    const remoteParticipants = useRemoteParticipants();

    useEffect(() => {
        const agentParticipant = remoteParticipants.find((p) =>
            p.identity.includes("agent")
        );

        const isAgentSpeaking =
            agentParticipant &&
            speakingParticipants.some(
                (p) => p.identity === agentParticipant.identity
            );

        if (isAgentSpeaking) {
            setOrbState("speaking");
        } else if (isMicrophoneEnabled) {
            setOrbState("listening");
        } else {
            setOrbState("idle");
        }
    }, [isMicrophoneEnabled, speakingParticipants, remoteParticipants]);

    const getOrbProps = () => {
        switch (orbState) {
            case "listening":
                return {
                    ...emeraldPreset,
                    animationSpeedBase: 1.5,
                    animationSpeedHue: 1.2,
                    mainOrbHueAnimation: true,
                };
            case "thinking":
                return {
                    ...goldenGlowPreset,
                    animationSpeedBase: 0.8,
                    animationSpeedHue: 1.5,
                    mainOrbHueAnimation: true,
                };
            case "speaking":
                return {
                    ...galaxyPreset,
                    animationSpeedBase: 2.0,
                    animationSpeedHue: 2.0,
                    mainOrbHueAnimation: true,
                };
            default:
                return {
                    ...oceanDepthsPreset,
                    animationSpeedBase: 0.5,
                    animationSpeedHue: 0.5,
                    mainOrbHueAnimation: false,
                };
        }
    };

    const handleOrbClick = () => {
        setShowPanel(!showPanel);
    };

    return (
        <OrbWrapper>
            <OrbContainer
                onClick={handleOrbClick}
                aria-label={
                    orbState === "listening"
                        ? "Luna is listening"
                        : orbState === "speaking"
                        ? "Luna is speaking"
                        : "Luna is active"
                }
            >
                <ReactAiOrb size={200} {...getOrbProps()} />
            </OrbContainer>
        </OrbWrapper>
    );
};

export default Orb;
