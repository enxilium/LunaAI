import React, { useRef, useState, useEffect } from "react";
import {
    Orb as ReactAiOrb,
    emeraldPreset,
    goldenGlowPreset,
    galaxyPreset,
    oceanDepthsPreset,
} from "react-ai-orb";
import {
    useVoiceAssistant,
    useParticipants,
    useTracks,
    LiveKitRoom,
    RoomAudioRenderer,
    useRoomContext,
} from "@livekit/components-react";
import {
    Track,
    RemoteAudioTrack,
    Room,
    LocalParticipant,
} from "livekit-client";
import styled from "styled-components";
import useKeywordDetection from "../../hooks/useKeywordDetection";

// Import LiveKit styles
import "@livekit/components-styles";
import "@livekit/components-styles/prefabs";

// Styled components for the orb container and arc panel
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

const ArcPanel = styled.div<{
    $visible: boolean;
    $side: "left" | "right";
    $panelCollapsed: boolean;
}>`
    position: absolute;
    top: 50%;
    ${(props) => (props.$side === "left" ? "left: 120px;" : "right: 120px;")}
    transform: translateY(-50%);
    width: ${(props) => (props.$panelCollapsed ? "40px" : "200px")};
    height: ${(props) => (props.$panelCollapsed ? "40px" : "160px")};
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: ${(props) => (props.$panelCollapsed ? "20px" : "80px")};
    display: flex;
    flex-direction: ${(props) => (props.$panelCollapsed ? "row" : "column")};
    align-items: center;
    justify-content: center;
    gap: ${(props) => (props.$panelCollapsed ? "0" : "15px")};
    padding: ${(props) => (props.$panelCollapsed ? "8px" : "20px")};
    opacity: ${(props) => (props.$visible ? 1 : 0)};
    pointer-events: ${(props) => (props.$visible ? "auto" : "none")};
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
`;

const PanelButton = styled.button<{ $collapsed: boolean }>`
    background: transparent;
    border: none;
    cursor: pointer;
    padding: ${(props) => (props.$collapsed ? "6px" : "12px")};
    border-radius: 50%;
    font-size: ${(props) => (props.$collapsed ? "16px" : "20px")};
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${(props) => (props.$collapsed ? "24px" : "40px")};
    height: ${(props) => (props.$collapsed ? "24px" : "40px")};

    &:hover {
        background: rgba(0, 0, 0, 0.1);
        transform: scale(1.1);
    }

    &:active {
        transform: scale(0.95);
    }
`;

const ToggleButton = styled.button<{ $side: "left" | "right" }>`
    position: absolute;
    top: 50%;
    ${(props) => (props.$side === "left" ? "right: -15px;" : "left: -15px;")}
    transform: translateY(-50%);
    width: 30px;
    height: 60px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;

    &:hover {
        background: rgba(255, 255, 255, 1);
        transform: translateY(-50%) scale(1.05);
    }

    &:active {
        transform: translateY(-50%) scale(0.95);
    }
`;

const Orb: React.FC = () => {
    // Set a data attribute on body for CSS targeting and remove scrollbars
    useEffect(() => {
        document.body.setAttribute("data-window-type", "orb");

        // Add CSS to eliminate margins and scrollbars
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.overflow = "hidden";

        return () => {
            document.body.removeAttribute("data-window-type");
            document.body.style.margin = "";
            document.body.style.padding = "";
            document.body.style.overflow = "";
        };
    }, []);

    const [serverUrl, setServerUrl] = useState<string>("");
    const [token, setToken] = useState<string>("");
    const [isConnecting, setIsConnecting] = useState(false);
    const [accessKey, setAccessKey] = useState<string | null>(null);
    const [showPanel, setShowPanel] = useState(false);
    const [panelCollapsed, setPanelCollapsed] = useState(true);
    const [panelSide, setPanelSide] = useState<"left" | "right">("left");

    // Get Picovoice access key
    useEffect(() => {
        const getAccessKey = async () => {
            try {
                const key = await window.electron.getAsset("key", "picovoice");
                setAccessKey(key);
            } catch (error) {
                console.warn("[Orb] Failed to get Picovoice key:", error);
            }
        };
        getAccessKey();
    }, []);

    // Determine panel side based on window position
    useEffect(() => {
        const updatePanelSide = async () => {
            try {
                const bounds = await window.electron.invoke(
                    "get-window-bounds"
                );
                const screenWidth = window.screen.width;
                const windowCenterX = bounds.x + bounds.width / 2;

                // If window is closer to right edge, show panel on left side
                setPanelSide(
                    windowCenterX > screenWidth / 2 ? "left" : "right"
                );
            } catch (error) {
                console.warn("[Orb] Failed to get window bounds:", error);
            }
        };

        updatePanelSide();

        // Update panel side when window moves
        const interval = setInterval(updatePanelSide, 1000);
        return () => clearInterval(interval);
    }, []);

    // Keyword detection hook
    const {
        isListening: isKeywordListening,
        isKeywordDetected,
    } = useKeywordDetection(accessKey);

    // Auto-start session when wake word is detected
    useEffect(() => {
        if (isKeywordDetected && !isConnecting && !serverUrl) {
            console.log("[Orb] Wake word detected, starting session...");
            startSession();
        }
    }, [isKeywordDetected, isConnecting, serverUrl]);

    const startSession = async () => {
        if (isConnecting) return;

        setIsConnecting(true);

        try {
            const sessionInfo = await window.electron.invoke(
                "livekit:start-session"
            );
            console.log("[Orb] Session info received:", sessionInfo);

            const {
                url,
                token: sessionToken,
                roomName,
                agentStarted,
            } = sessionInfo;

            if (!sessionToken || typeof sessionToken !== "string") {
                throw new Error(
                    `Invalid token received: ${typeof sessionToken}`
                );
            }

            if (!agentStarted) {
                throw new Error("Failed to start Python agent");
            }

            setServerUrl(url);
            setToken(sessionToken);
        } catch (error) {
            console.error("[Orb] Failed to start session:", error);
            setIsConnecting(false);
        }
    };

    const stopSession = async () => {
        try {
            console.log("[Orb] Stopping agent...");
            const result = await window.electron.invoke("livekit:stop-agent");
            console.log("[Orb] Agent stop result:", result);

            setServerUrl("");
            setToken("");
            setIsConnecting(false);
            setShowPanel(false);
            setPanelCollapsed(true);
            window.electron.send("audio-stream-end");
        } catch (error) {
            console.error("[Orb] Failed to stop session:", error);
        }
    };

    const handleOrbClick = () => {
        if (serverUrl) {
            // If connected, toggle panel
            if (showPanel) {
                if (panelCollapsed) {
                    setPanelCollapsed(false);
                } else {
                    setShowPanel(false);
                    setPanelCollapsed(true);
                }
            } else {
                setShowPanel(true);
                setPanelCollapsed(true);
            }
        } else {
            // If not connected, start session
            startSession();
        }
    };

    // Connected state - render LiveKit room with orb content
    return (
        <LiveKitRoom
            serverUrl={serverUrl}
            token={token}
            connect={true}
            audio={true}
            video={false}
            onConnected={() => {
                console.log("[User] Connected to room.");
                window.electron.send("show-orb");
                setIsConnecting(false);
            }}
            onDisconnected={() => {
                console.log("[User] Disconnected from room.");
            }}
            onError={(error) => {
                console.error("[Orb] LiveKit error:", error);
                setIsConnecting(false);
            }}
        >
            <RoomAudioRenderer />
            <ConnectedOrbContent
                onStopSession={stopSession}
                onOrbClick={handleOrbClick}
                showPanel={showPanel}
                panelCollapsed={panelCollapsed}
                panelSide={panelSide}
                setPanelCollapsed={setPanelCollapsed}
                isInitializing={isConnecting}
            />
        </LiveKitRoom>
    );
};

// Audio analyzer for visualizing audio levels
class AudioAnalyzer {
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private dataArray: Uint8Array | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private isInitialized = false;

    initialize(track: RemoteAudioTrack | null): boolean {
        if (!track || this.isInitialized) return false;

        try {
            const mediaStreamTrack = track.mediaStreamTrack;
            if (!mediaStreamTrack) return false;

            // Create audio context and analyzer
            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();

            // Configure analyzer
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            // Create source from track
            const mediaStream = new MediaStream([mediaStreamTrack]);
            this.source =
                this.audioContext.createMediaStreamSource(mediaStream);
            this.source.connect(this.analyser);

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error("[AudioAnalyzer] Failed to initialize:", error);
            return false;
        }
    }

    getAudioLevel(): number {
        if (!this.analyser || !this.dataArray) return 0;

        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Calculate average level
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }

        // Return normalized value between 0 and 1
        return sum / (this.dataArray.length * 255);
    }

    cleanup(): void {
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }

        if (this.audioContext) {
            this.audioContext.close().catch(console.error);
            this.audioContext = null;
        }

        this.analyser = null;
        this.dataArray = null;
        this.isInitialized = false;
    }
}

// Separate component to use LiveKit hooks inside LiveKitRoom context
function ConnectedOrbContent({
    onStopSession,
    onOrbClick,
    showPanel,
    panelCollapsed,
    panelSide,
    setPanelCollapsed,
    isInitializing,
}: {
    onStopSession: () => void;
    onOrbClick: () => void;
    showPanel: boolean;
    panelCollapsed: boolean;
    panelSide: "left" | "right";
    setPanelCollapsed: (collapsed: boolean) => void;
    isInitializing: boolean;
}) {
    const [orbState, setOrbState] = useState<
        "idle" | "listening" | "thinking" | "speaking"
    >("idle");
    const [orbSize, setOrbSize] = useState(1.2);
    const [isAudioActive, setIsAudioActive] = useState(false);
    const audioAnalyzerRef = useRef<AudioAnalyzer>(new AudioAnalyzer());

    // Get access to the Room instance
    const room = useRoomContext();

    // LiveKit components hooks (work within LiveKitRoom context)
    const { state: vaState } = useVoiceAssistant();
    const tracks = useTracks([Track.Source.Microphone], {
        onlySubscribed: false,
    });
    const participants = useParticipants();

    // Handle stopping session with immediate disconnect
    const handleStopSession = async () => {
        try {
            console.log("[Orb] Disconnecting from room...");
            // First disconnect the room for immediate UI feedback
            room.disconnect();

            // Then stop the agent in the background
            onStopSession();
        } catch (error) {
            console.error("[Orb] Failed to disconnect:", error);
            // Fall back to regular stop if disconnect fails
            onStopSession();
        }
    };

    // Detect if agent is speaking based on remote audio tracks
    const isAgentSpeaking = tracks.some(
        (track) =>
            track.publication.kind === Track.Kind.Audio &&
            track.publication.isSubscribed &&
            !track.participant.isLocal
    );

    // Get the remote audio track for analysis
    const remoteAudioTrack = tracks.find(
        (trackRef) =>
            trackRef.publication.kind === Track.Kind.Audio &&
            !trackRef.participant.isLocal &&
            trackRef.publication.isSubscribed
    )?.publication.track as RemoteAudioTrack | undefined;

    // Initialize audio analyzer when track is available
    useEffect(() => {
        if (remoteAudioTrack) {
            audioAnalyzerRef.current.initialize(remoteAudioTrack);
        }

        return () => {
            audioAnalyzerRef.current.cleanup();
        };
    }, [remoteAudioTrack]);

    // Map LiveKit voice assistant state to orb state
    useEffect(() => {
        if (isInitializing) {
            setOrbState("idle");
            return;
        }

        if (isAgentSpeaking) {
            setOrbState("speaking");
            setIsAudioActive(true);
        } else if (vaState === "listening") {
            setOrbState("listening");
            setIsAudioActive(true);
        } else if (vaState === "thinking") {
            setOrbState("thinking");
            setIsAudioActive(false);
        } else {
            setOrbState("idle");
            setIsAudioActive(false);
        }
    }, [isAgentSpeaking, vaState, isInitializing]);

    // Pulsate orb size based on audio activity and levels
    useEffect(() => {
        if (isAudioActive) {
            const pulsate = () => {
                if (orbState === "speaking" && remoteAudioTrack) {
                    // Get audio level from analyzer
                    const level = audioAnalyzerRef.current.getAudioLevel();

                    // Map audio level to size (base size 1.15, max growth 0.2)
                    const minSize = 1.15;
                    const maxGrowth = 0.2;
                    const newSize = minSize + level * maxGrowth;

                    // Update orb size based on audio level
                    setOrbSize(newSize);
                } else {
                    // For non-speaking states or when analyzer isn't available,
                    // use gentle random pulsation
                    setOrbSize(1.15 + Math.random() * 0.1);
                }
            };

            const interval = setInterval(pulsate, 100);
            return () => clearInterval(interval);
        } else {
            // Reset to default size when not active
            setOrbSize(1.2);
        }
    }, [isAudioActive, orbState, remoteAudioTrack]);

    // Get local participant for microphone control
    const localParticipant = participants.find((p) => p.isLocal);

    // Panel actions
    const panelActions = [
        {
            icon: "🎤",
            label: "Toggle Microphone",
            action: async () => {
                if (localParticipant) {
                    const isEnabled = localParticipant.isMicrophoneEnabled;
                    await (
                        localParticipant as LocalParticipant
                    ).setMicrophoneEnabled(!isEnabled);
                }
            },
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

    // Determine orb palette and animation based on state
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

            {/* Arc Panel for controls */}
            <ArcPanel
                $visible={showPanel}
                $side={panelSide}
                $panelCollapsed={panelCollapsed}
            >
                {!panelCollapsed && (
                    <ToggleButton
                        $side={panelSide}
                        onClick={() => setPanelCollapsed(true)}
                    >
                        {panelSide === "left" ? "◀" : "▶"}
                    </ToggleButton>
                )}

                {panelCollapsed ? (
                    <PanelButton
                        $collapsed={true}
                        onClick={() => setPanelCollapsed(false)}
                        title="Expand controls"
                    >
                        ⚙️
                    </PanelButton>
                ) : (
                    panelActions.map((action, index) => (
                        <PanelButton
                            key={index}
                            $collapsed={false}
                            onClick={action.action}
                            title={action.label}
                        >
                            {action.icon}
                        </PanelButton>
                    ))
                )}
            </ArcPanel>
        </OrbWrapper>
    );
}

export default Orb;
