import { useState, useEffect, useRef } from "react";
import { RemoteAudioTrack } from "livekit-client";

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

            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            const mediaStream = new MediaStream([mediaStreamTrack]);
            this.source = this.audioContext.createMediaStreamSource(mediaStream);
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

        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
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

const useAudio = (track: RemoteAudioTrack | undefined) => {
    const [audioLevel, setAudioLevel] = useState(0);
    const audioAnalyzerRef = useRef<AudioAnalyzer>(new AudioAnalyzer());

    useEffect(() => {
        if (track) {
            audioAnalyzerRef.current.initialize(track);
        }

        return () => {
            audioAnalyzerRef.current.cleanup();
        };
    }, [track]);

    useEffect(() => {
        if (track) {
            const interval = setInterval(() => {
                const level = audioAnalyzerRef.current.getAudioLevel();
                setAudioLevel(level);
            }, 100);
            return () => clearInterval(interval);
        }
    }, [track]);

    return audioLevel;
};

export default useAudio;