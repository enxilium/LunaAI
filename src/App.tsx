import { ThemeProvider } from "styled-components";
import { theme } from "./styles/theme";
import Orb from "./components/Orb";
import "./styles/globals.css";
import { useEffect, useState } from "react";

function App() {
    const [isOrbWindow, setIsOrbWindow] = useState(false);
    const [isListening, setIsListening] = useState(false);

    // Determine which window we're in based on URL parameter
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const windowType = urlParams.get("window");
        setIsOrbWindow(windowType === "orb");
    }, []);

    // Function to toggle listening state
    const toggleListening = () => {
        const newState = !isListening;
        setIsListening(newState);

        if (window.electron) {
            window.electron.send({
                command: newState ? "start-listen" : "stop-listen",
                args: {},
            });
        }
    };

    // Listen for system responses
    useEffect(() => {
        if (window.electron) {
            window.electron.receive("system-response", (response) => {
                console.log("System response:", response);
                setIsListening(response.status === "listening");
            });
        }
    }, []);

    // Render different content based on which window we're in
    if (isOrbWindow) {
        // Orb window content (just the orb)
        return (
            <ThemeProvider theme={theme}>
                <OrbContainer>
                    <Orb />
                </OrbContainer>
            </ThemeProvider>
        );
    }

    // Main window content (configuration UI)
    return (
        <ThemeProvider theme={theme}>
            <div className="App">
                <h1>Luna AI</h1>
                <p>Configure your AI assistant</p>

                {/* Test button for toggling listening state */}
                <button onClick={toggleListening}>
                    {isListening ? "Stop Listening" : "Start Listening"}
                </button>

                <p>Status: {isListening ? "Listening" : "Idle"}</p>
            </div>
        </ThemeProvider>
    );
}

// Style for the orb window container
const OrbContainer = ({ children }: { children: React.ReactNode }) => {
    // Set a data attribute on body for CSS targeting
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

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                overflow: "hidden",
            }}
        >
            {children}
        </div>
    );
};

export default App;
