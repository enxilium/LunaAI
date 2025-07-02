import { useState, useRef, useEffect, useCallback } from "react";
import { Buffer } from "buffer";

/**
 * @description Custom hook for managing audio recording and playback.
 * @returns {{
 *  isRecording: boolean;
 *  startRecording: () => Promise<void>;
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
    const pendingAudioCountRef = useRef(0);
    const playbackEndTimerRef = useRef<NodeJS.Timeout | null>(null);

    const startRecording = useCallback(async () => {
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
                audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);

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

                const base64 = Buffer.from(int16Data.buffer).toString("base64");
                window.electron.send("gemini:audio-data" as any, base64);
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
    }, []);

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
        if (playbackEndTimerRef.current) {
            clearTimeout(playbackEndTimerRef.current);
            playbackEndTimerRef.current = null;
        }
        if (outputAudioContextRef.current) {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }
        setIsPlaying(false);
        pendingAudioCountRef.current = 0;
    }, []);

    const playAudio = useCallback(
        (audioData: string) =>
            new Promise<void>(async (resolve, reject) => {
                if (playbackEndTimerRef.current) {
                    clearTimeout(playbackEndTimerRef.current);
                    playbackEndTimerRef.current = null;
                }
                pendingAudioCountRef.current++;
                setIsPlaying(true);

                if (!outputAudioContextRef.current) {
                    outputAudioContextRef.current = new AudioContext({
                        sampleRate: 24000,
                    });
                    nextStartTimeRef.current =
                        outputAudioContextRef.current.currentTime;
                }

                if (outputAudioContextRef.current.state === "suspended") {
                    await outputAudioContextRef.current.resume();
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

                    const currentTime = audioContext.currentTime;
                    const startTime = Math.max(
                        currentTime,
                        nextStartTimeRef.current
                    );
                    const duration = audioBuffer.duration;
                    const endTime = startTime + duration;

                    // Calculate when this audio chunk will finish playing
                    const timeUntilEnd = (endTime - currentTime) * 1000;

                    // Flag to ensure we only resolve once
                    let hasResolved = false;

                    // Function to handle completion
                    const completePlayback = () => {
                        if (!hasResolved) {
                            hasResolved = true;
                            pendingAudioCountRef.current--;
                            if (pendingAudioCountRef.current === 0) {
                                playbackEndTimerRef.current = setTimeout(() => {
                                    setIsPlaying(false);
                                }, 250);
                            }
                            resolve();
                        }
                    };

                    source.onended = completePlayback;

                    // Backup resolution in case onended doesn't fire
                    const timer = setTimeout(
                        completePlayback,
                        timeUntilEnd + 100
                    ); // Add small buffer

                    source.addEventListener("ended", () => clearTimeout(timer));

                    source.start(startTime);
                    nextStartTimeRef.current = endTime;
                } catch (e) {
                    console.error("Error playing audio chunk:", e);
                    pendingAudioCountRef.current--;
                    if (pendingAudioCountRef.current === 0) {
                        setIsPlaying(false);
                    }
                    reject(e);
                }
            }),
        []
    );

    return {
        isRecording,
        startRecording,
        stopRecording,
        playAudio,
        stopAudio,
        isPlaying,
    };
}
