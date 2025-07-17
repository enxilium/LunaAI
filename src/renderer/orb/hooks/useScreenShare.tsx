import { useState, useCallback } from "react";

export const useScreenShare = () => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startScreenShare =
        useCallback(async (): Promise<MediaStream | null> => {
            setError(null);
            try {
                const primarySource =
                    await window.electron.getPrimaryScreenSource();
                if (!primarySource) {
                    throw new Error("No primary screen source found.");
                }

                const constraints = await window.electron.getMediaConstraints(
                    primarySource.id
                );
                const mediaStream = await navigator.mediaDevices.getUserMedia(
                    constraints as any
                );

                setStream(mediaStream);
                setIsSharing(true);
                await window.electron.startScreenCapture(primarySource.id);
                return mediaStream;
            } catch (err) {
                const errorMessage =
                    err instanceof Error ? err.message : String(err);
                console.error("Error starting screen share:", errorMessage);
                setError(errorMessage);
                setIsSharing(false);
                return null;
            }
        }, []);

    const stopScreenShare = useCallback(async () => {
        setError(null);
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
        setStream(null);
        setIsSharing(false);
        try {
            await window.electron.stopScreenCapture();
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : String(err);
            console.error("Error stopping screen share:", errorMessage);
            setError(errorMessage);
        }
    }, [stream]);

    return { stream, isSharing, error, startScreenShare, stopScreenShare };
};
