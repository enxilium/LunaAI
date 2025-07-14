import { ThemeProvider } from "styled-components";
import { theme } from "./styles/theme";
import Orb from "./components/orb/OrbContainer";
import SettingsPage from "./pages/SettingsPage";
import Configuration from "./pages/Configuration";
import "./styles/globals.css";
import { useEffect, useState } from "react";
import React from "react";

function App() {
    const [windowType, setWindowType] = useState("");

    // Determine which window we're in based on URL parameter
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        setWindowType(urlParams.get("window") as string);
    }, []);

    const toSettingsPage = () => {
        setWindowType("settings");
    };

    const toConfiguration = () => {
        setWindowType("configuration");
    };

    let page;

    // Render different content based on which window we're in
    switch (windowType) {
        case "orb":
            // Orb window content (new LiveKit voice assistant)
            page = <Orb />;
            break;
        case "settings":
            page = <SettingsPage />;
            break;
        case "configuration":
            page = <Configuration />;
            break;
        default:
            // Home page
            page = (
                <div className="App">
                    <h1 className="">Luna AI</h1>
                    <p>Configure your AI assistant</p>

                    <button onClick={toSettingsPage}>Settings</button>
                    <p> </p>
                    <button onClick={toConfiguration}>Configuration</button>
                </div>
            );
    }

    return <ThemeProvider theme={theme}>{page}</ThemeProvider>;
}

export default App;
