import { createRoot } from "react-dom/client";
import OrbContainer from "./components/OrbContainer";
import "./styles/globals.css";
import React from "react";
import { ConnectionProvider } from "./hooks/useConnection";

// Pre-grant screen capture permissions on app startup
let preGrantedStream: MediaStream | null = null;

const preGrantScreenCapture = async () => {
    try {
        console.log("[Startup] Pre-granting screen capture permissions...");
        const primarySource = await window.electron.getPrimaryScreenSource();
        if (primarySource) {
            const constraints = await window.electron.getMediaConstraints(
                primarySource.id
            );
            const testStream = await navigator.mediaDevices.getUserMedia(
                constraints as any
            );

            // Keep the stream active instead of stopping it immediately
            preGrantedStream = testStream;
            console.log(
                "[Startup] Screen capture permissions pre-granted successfully - stream kept active"
            );

            // Make the stream globally accessible
            (window as any).preGrantedScreenStream = testStream;
        }
    } catch (error) {
        console.warn(
            "[Startup] Failed to pre-grant screen capture permissions:",
            error
        );
    }
};

const container = document.getElementById("orb-root");
const root = createRoot(container!);

// Grant permissions before rendering
preGrantScreenCapture().then(() => {
    root.render(
        <ConnectionProvider>
            <OrbContainer />
        </ConnectionProvider>
    );
});
