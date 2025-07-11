import { useState, useEffect, useRef } from "react";
import { useVoiceAssistant, useTracks, useParticipants } from "@livekit/components-react";
import {
    RemoteAudioTrack,
    LocalParticipant,
    Room,
    Track,
    LocalTrackPublication,
} from "livekit-client";
import useKeywordDetection from "./useKeywordDetection";
import useAudio from "./useAudio";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

export const useOrb = (
    accessKey: string | null,
    isConnecting: boolean,
    room: Room
) => {
    const [orbState, setOrbState] = useState<OrbState>("idle");
    const [orbSize, setOrbSize] = useState(1.2);
    const [isAudioActive, setIsAudioActive] = useState(false);

    const { isListening: isKeywordListening, isKeywordDetected } = useKeywordDetection(accessKey);
    const { state: vaState } = useVoiceAssistant();
    const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });
    const participants = useParticipants();

    const remoteAudioTrack = tracks.find(
        (trackRef) =>
            trackRef.publication.kind === Track.Kind.Audio &&
            !trackRef.participant.isLocal &&
            trackRef.publication.isSubscribed
    )?.publication.track as RemoteAudioTrack | undefined;

    const audioLevel = useAudio(remoteAudioTrack);

    const isAgentSpeaking = tracks.some(
        (track) =>
            track.publication.kind === Track.Kind.Audio &&
            track.publication.isSubscribed &&
            !track.participant.isLocal
    );

    useEffect(() => {
        if (isConnecting) {
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
    }, [isAgentSpeaking, vaState, isConnecting]);

    useEffect(() => {
        if (isAudioActive) {
            const pulsate = () => {
                if (orbState === "speaking") {
                    const minSize = 1.15;
                    const maxGrowth = 0.2;
                    const newSize = minSize + audioLevel * maxGrowth;
                    setOrbSize(newSize);
                } else {
                    setOrbSize(1.15 + Math.random() * 0.1);
                }
            };

            const interval = setInterval(pulsate, 100);
            return () => clearInterval(interval);
        } else {
            setOrbSize(1.2);
        }
    }, [isAudioActive, orbState, audioLevel]);

    const localParticipant = participants.find((p) => p.isLocal);

    const toggleMicrophone = async () => {
        if (localParticipant) {
            const isEnabled = localParticipant.isMicrophoneEnabled;
            await (localParticipant as LocalParticipant).setMicrophoneEnabled(!isEnabled);
        }
    };

    return {
        orbState,
        orbSize,
        isKeywordListening,
        isKeywordDetected,
        toggleMicrophone,
    };
};