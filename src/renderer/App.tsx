import { ThemeProvider } from "styled-components";
import { theme } from "./styles/theme";
import Orb from "./components/Orb";
import OrbContainer from "./components/OrbContainer";
import SettingsPage from "./pages/SettingsPage";
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

    let page;

    // Render different content based on which window we're in
    switch (windowType) {
        case "orb":
            // Orb window content (just the orb)
            page = (
                <OrbContainer>
                    <Orb />
                </OrbContainer>
            );
            break;
        case "settings":
            page = <SettingsPage />;
            break;
        default:
            // Home page
            page = (
                <div className="App">
                    <h1 className="">Luna AI</h1>
                    <p>Configure your AI assistant</p>

                    <button onClick={toSettingsPage}>Settings</button>
                </div>
            );
    }

    return <ThemeProvider theme={theme}>{page}</ThemeProvider>;
}

export default App;
