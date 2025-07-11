import React from "react";
import styled from "styled-components";
import {
    Orb as ReactAiOrb,
    emeraldPreset,
    goldenGlowPreset,
    galaxyPreset,
    oceanDepthsPreset,
} from "react-ai-orb";
import { useRoomContext } from "@livekit/components-react";
import { useOrb, OrbState } from "../../hooks/useOrb";
import ArcPanel from "./ArcPanel";

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

interface ConnectedOrbContentProps {
    onStopSession: () => void;
    onOrbClick: () => void;
    showPanel: boolean;
    panelCollapsed: boolean;
    panelSide: "left" | "right";
    setPanelCollapsed: (collapsed: boolean) => void;
    isInitializing: boolean;
    accessKey: string | null;
}

const ConnectedOrbContent: React.FC<ConnectedOrbContentProps> = ({
    onStopSession,
    onOrbClick,
    showPanel,
    panelCollapsed,
    panelSide,
    setPanelCollapsed,
    isInitializing,
    accessKey,
}) => {
    const room = useRoomContext();
    const { orbState, orbSize, toggleMicrophone } = useOrb(
        accessKey,
        isInitializing,
        room
    );

    const handleStopSession = async () => {
        try {
            console.log("[Orb] Disconnecting from room...");
            room.disconnect();
            onStopSession();
        } catch (error) {
            console.error("[Orb] Failed to disconnect:", error);
            onStopSession();
        }
    };

    const panelActions = [
        {
            icon: "🎤",
            label: "Toggle Microphone",
            action: toggleMicrophone,
        },
        {
            icon: "⏹️",
            label: "Stop Session",
            action: handleStopSession,
        },
        {
            icon: "🔊",
            label: "Audio Settings",
            action: () => console.log("Audio settings"),
        },
        {
            icon: "⚙️",
            label: "Settings",
            action: () => console.log("Settings"),
        },
    ];

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

    return (
        <OrbWrapper>
            <OrbContainer
                onClick={onOrbClick}
                aria-label={
                    isInitializing
                        ? "Luna is initializing..."
                        : orbState === "listening"
                        ? "Luna is listening"
                        : orbState === "thinking"
                        ? "Luna is thinking"
                        : orbState === "speaking"
                        ? "Luna is speaking"
                        : "Luna is active - click for controls"
                }
            >
                <ReactAiOrb size={orbSize} {...getOrbProps()} />
            </OrbContainer>

            <ArcPanel
                visible={showPanel}
                side={panelSide}
                collapsed={panelCollapsed}
                setCollapsed={setPanelCollapsed}
                actions={panelActions}
            />
        </OrbWrapper>
    );
};

export default ConnectedOrbContent;
