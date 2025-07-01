import { useState, useRef, useCallback } from "react";
import { Buffer } from "buffer";

/**
 * @description Custom hook for managing audio recording and playback.
 * @returns {{
 *  isRecording: boolean;
 *  startRecording: (onProcess: (audioData: string) => void) => Promise<void>;
 *  stopRecording: () => void;
 *  playAudio: (audioData: string) => Promise<void>;
 *  stopAudio: () => void;
 *  isPlaying: boolean;
 * }}
 */
export default function useAudio() {
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(
        null
    );
    const nextStartTimeRef = useRef(0);

    const startRecording = useCallback(
        async (onProcess: (audioData: string) => void) => {
            console.log("useAudio: Starting recording...");
            setIsRecording(true);
            try {
                if (!audioContextRef.current) {
                    audioContextRef.current = new AudioContext({
                        sampleRate: 16000,
                    });
                }
                if (audioContextRef.current.state === "suspended") {
                    await audioContextRef.current.resume();
                }

                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                mediaStreamRef.current = stream;

                mediaStreamSourceRef.current =
                    audioContextRef.current.createMediaStreamSource(stream);

                const bufferSize = 4096;
                scriptProcessorNodeRef.current =
                    audioContextRef.current.createScriptProcessor(
                        bufferSize,
                        1,
                        1
                    );

                scriptProcessorNodeRef.current.onaudioprocess = (
                    event: AudioProcessingEvent
                ) => {
                    const float32Data = event.inputBuffer.getChannelData(0);

                    // Convert Float32 to Int16
                    const int16Data = new Int16Array(float32Data.length);
                    for (let i = 0; i < float32Data.length; i++) {
                        int16Data[i] =
                            Math.max(-1, Math.min(1, float32Data[i])) * 32767;
                    }

                    const base64 = Buffer.from(int16Data.buffer).toString(
                        "base64"
                    );
                    onProcess(base64);
                };

                mediaStreamSourceRef.current.connect(
                    scriptProcessorNodeRef.current
                );
                scriptProcessorNodeRef.current.connect(
                    audioContextRef.current.destination
                );
            } catch (error) {
                console.error("useAudio: Error starting recording:", error);
                setIsRecording(false);
            }
        },
        []
    );

    const stopRecording = useCallback(() => {
        console.log("useAudio: Stopping recording.");
        setIsRecording(false);

        if (scriptProcessorNodeRef.current) {
            scriptProcessorNodeRef.current.disconnect();
            scriptProcessorNodeRef.current.onaudioprocess = null;
            scriptProcessorNodeRef.current = null;
        }

        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current
                .getTracks()
                .forEach((track: MediaStreamTrack) => track.stop());
            mediaStreamRef.current = null;
        }
    }, []);

    const stopAudio = useCallback(() => {
        console.log("useAudio: Stopping audio.");
        if (outputAudioContextRef.current) {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }
        setIsPlaying(false);
    }, []);

    const playAudio = useCallback(async (audioData: string) => {
        console.log("useAudio: Playing audio chunk");
        setIsPlaying(true);

        if (!outputAudioContextRef.current) {
            outputAudioContextRef.current = new AudioContext({
                sampleRate: 24000,
            });
            nextStartTimeRef.current =
                outputAudioContextRef.current.currentTime;
        }

        try {
            const audioContext = outputAudioContextRef.current;
            const buffer = Buffer.from(audioData, "base64");
            const pcm16Data = new Int16Array(
                buffer.buffer,
                buffer.byteOffset,
                buffer.byteLength / Int16Array.BYTES_PER_ELEMENT
            );

            const pcm32Data = new Float32Array(pcm16Data.length);
            for (let i = 0; i < pcm16Data.length; i++) {
                pcm32Data[i] = pcm16Data[i] / 32768;
            }

            const audioBuffer = audioContext.createBuffer(
                1,
                pcm32Data.length,
                24000
            );
            audioBuffer.getChannelData(0).set(pcm32Data);

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);

            source.onended = () => {
                setIsPlaying(false);
            };

            const currentTime = audioContext.currentTime;
            const startTime = Math.max(currentTime, nextStartTimeRef.current);

            source.start(startTime);
            nextStartTimeRef.current = startTime + audioBuffer.duration;
        } catch (e) {
            console.error("Error playing audio chunk:", e);
            setIsPlaying(false);
        }
    }, []);

    return {
        isRecording,
        startRecording,
        stopRecording,
        playAudio,
        stopAudio,
        isPlaying,
    };
}
