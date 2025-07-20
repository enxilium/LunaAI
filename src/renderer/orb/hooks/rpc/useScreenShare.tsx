import { useState, useCallback } from "react";

export const useScreenShare = () => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Cache the stream to reuse it and avoid permission requests
    const startScreenShare =
        useCallback(async (): Promise<MediaStream | null> => {
            setError(null);

            // If we already have a stream, return it
            if (stream && stream.active) {
                console.log("[Screen Share] Reusing existing stream");
                return stream;
            }

            // Try to use the pre-granted stream first
            const preGrantedStream = (window as any).preGrantedScreenStream as
                | MediaStream
                | undefined;
            if (preGrantedStream && preGrantedStream.active) {
                console.log("[Screen Share] Using pre-granted stream");
                setStream(preGrantedStream);
                setIsSharing(true);

                // Still call startScreenCapture to register with the backend
                try {
                    const primarySource =
                        await window.electron.getPrimaryScreenSource();
                    if (primarySource) {
                        await window.electron.startScreenCapture(
                            primarySource.id
                        );
                    }
                } catch (err) {
                    console.warn(
                        "[Screen Share] Backend registration warning:",
                        err
                    );
                }

                return preGrantedStream;
            }

            try {
                console.log("[Screen Share] Starting new screen capture...");
                const primarySource =
                    await window.electron.getPrimaryScreenSource();
                if (!primarySource) {
                    throw new Error("No primary screen source found.");
                }

                const constraints = await window.electron.getMediaConstraints(
                    primarySource.id
                );

                // Try to get media stream without triggering permission dialog
                const mediaStream = await navigator.mediaDevices.getUserMedia(
                    constraints as any
                );

                console.log(
                    "[Screen Share] Media stream obtained successfully"
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
        }, [stream]);

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
