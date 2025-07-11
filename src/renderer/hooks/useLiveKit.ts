import { useState, useEffect } from "react";

export const useLiveKit = () => {
    const [serverUrl, setServerUrl] = useState<string>("");
    const [token, setToken] = useState<string>("");
    const [isConnecting, setIsConnecting] = useState(false);

    const startSession = async () => {
        if (isConnecting) return;

        setIsConnecting(true);

        try {
            const sessionInfo = await window.electron.invoke("livekit:start-session");
            console.log("[Orb] Session info received:", sessionInfo);

            const { url, token: sessionToken, roomName, agentStarted } = sessionInfo;

            if (!sessionToken || typeof sessionToken !== "string") {
                throw new Error(`Invalid token received: ${typeof sessionToken}`);
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
            window.electron.send("audio-stream-end");
        } catch (error) {
            console.error("[Orb] Failed to stop session:", error);
        }
    };

    return {
        serverUrl,
        token,
        isConnecting,
        setIsConnecting,
        startSession,
        stopSession,
    };
};