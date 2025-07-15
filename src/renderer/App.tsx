import { ThemeProvider } from "styled-components";
import { theme } from "./styles/theme";
import Orb from "./components/orb/OrbContainer";
import SettingsPage from "./pages/SettingsPage";
import Configuration from "./pages/Configuration";
import TestOrb from "./pages/TestOrb";
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

    const toOrb = () => {
        setWindowType("orb-test");
    };

    let page;

    // Render different content based on which window we're in
    switch (windowType) {
        case "orb":
            // Orb window content (new LiveKit voice assistant)
            page = <Orb />;
            break;
        case "settings":
            page = <SettingsPage goBack={() => setWindowType("")}/>;
            break;
        case "configuration":
            page = <Configuration goBack={() => setWindowType("")}/>;
            break;
        case "orb-test":
            page = <TestOrb goBack={() => setWindowType("")}/>;
            break;
        default:
            // Home page
            page = (
                <div className="App p-10">
                    <h1 className="text-lg font-semibold">Luna AI</h1>
                    <p className="mb-4 text-gray-400 text-sm">Configure your AI assistant</p>
                    <button onClick={toSettingsPage}>Settings</button>
                    <p> </p>
                    <button onClick={toConfiguration}>Configuration</button>
                    <p> </p>
                    <button onClick={toOrb}>Orb</button>
                </div>
            );
    }

    return <ThemeProvider theme={theme}>{page}</ThemeProvider>;
}

export default App;
