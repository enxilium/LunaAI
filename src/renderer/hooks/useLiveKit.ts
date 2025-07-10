// src/renderer/hooks/useLiveKit.ts
import { useState, useCallback, useRef, useEffect } from "react";
import {
    Room,
    RoomEvent,
    Track,
    RemoteTrack,
    RemoteAudioTrack,
} from "livekit-client";
import useError from "./useError";

/**
 * Hook for managing LiveKit room connection and audio
 * Complete replacement for the current Gemini Live connection
 *
 * Note: This hook provides the room and basic connection state.
 * For agent-specific features like voice assistant state and visualizer,
 * use the LiveKit components (useVoiceAssistant, BarVisualizer) after connection.
 */
export default function useLiveKit() {
    const [isConnected, setIsConnected] = useState(false);
    const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [room, setRoom] = useState<Room | null>(null);
    const { reportError } = useError();

    // Refs for managing state
    const isSessionActiveRef = useRef(isSessionActive);
    isSessionActiveRef.current = isSessionActive;

    const startSession = useCallback(async () => {
        try {
            // Start session (creates room and starts Python agent)
            const sessionInfo = await window.electron.invoke(
                "livekit:start-session"
            );

            const { url, token, roomName, agentStarted } = sessionInfo;

            if (!token || typeof token !== "string") {
                throw new Error(`Invalid token received: ${typeof token}`);
            }

            if (!agentStarted) {
                throw new Error("Failed to start Python agent");
            }

            const newRoom = new Room();

            // Set up event handlers
            newRoom.on(RoomEvent.Connected, () => {
                setIsConnected(true);
                setIsSessionActive(true);
            });

            newRoom.on(RoomEvent.Disconnected, () => {
                setIsConnected(false);
                setIsAgentSpeaking(false);
                setIsSessionActive(false);
            });

            // Handle agent audio
            newRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
                if (track.kind === Track.Kind.Audio) {
                    const audioTrack = track as RemoteAudioTrack;

                    // Play agent audio through speakers
                    const audioElement = audioTrack.attach();
                    audioElement.autoplay = true;
                    audioElement
                        .play()
                        .catch((err) =>
                            console.warn(
                                "[LiveKit] Audio autoplay failed:",
                                err
                            )
                        );

                    setIsAgentSpeaking(true);
                }
            });

            newRoom.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
                if (track.kind === Track.Kind.Audio) {
                    setIsAgentSpeaking(false);
                }
            });

            // Handle data messages (for tool responses, etc.)
            newRoom.on(RoomEvent.DataReceived, (payload, participant) => {
                if (participant) {
                    try {
                        const message = new TextDecoder().decode(payload);
                        // TODO: Handle agent data messages (tool responses, etc.)
                    } catch (err) {
                        console.warn(
                            "[LiveKit] Failed to decode data message:",
                            err
                        );
                    }
                }
            });

            // Connect to the room
            await newRoom.connect(url, token);

            // Enable microphone for the local participant
            await newRoom.localParticipant.setMicrophoneEnabled(true);

            setRoom(newRoom);
            return true;
        } catch (error) {
            reportError(
                `Failed to start LiveKit session: ${error}`,
                "useLiveKit"
            );
            return false;
        }
    }, [reportError]);

    const closeSession = useCallback(async () => {
        if (room) {
            await room.disconnect();
            setRoom(null);
            setIsConnected(false);
            setIsAgentSpeaking(false);
            setIsSessionActive(false);
        }

        // Stop the Python agent
        try {
            console.log("Renderer - stopping Python agent");
            await window.electron.invoke("livekit:stop-agent");
        } catch (error) {
            console.warn("[LiveKit] Failed to stop Python agent:", error);
        }
    }, [room]);

    const toggleMicrophone = useCallback(async () => {
        if (room) {
            const isEnabled = room.localParticipant.isMicrophoneEnabled;
            await room.localParticipant.setMicrophoneEnabled(!isEnabled);
            return !isEnabled;
        }
        return false;
    }, [room]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (room) {
                room.disconnect();
            }
        };
    }, [room]);

    return {
        // Core session management (compatible with useGemini interface)
        isSessionActive,
        startSession,
        closeSession,

        // Audio state (compatible with useGemini interface)
        isSpeaking: isAgentSpeaking,

        // LiveKit specific state
        isConnected,
        isAgentSpeaking,
        toggleMicrophone,
        room,
    };
}
