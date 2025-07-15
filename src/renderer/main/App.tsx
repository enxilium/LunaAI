import React from "react";
import SettingsPage from "./pages/SettingsPage";
import Configuration from "./pages/Configuration";
import "./styles/globals.css";
import { useEffect, useState } from "react";

function App() {
    const [page, setPage] = useState("");

    const toSettingsPage = () => {
        setPage("settings");
    };

    const toConfiguration = () => {
        setPage("configuration");
    };

    let pageComponent;

    switch (page) {
        case "settings":
            pageComponent = <SettingsPage />;
            break;
        case "configuration":
            pageComponent = <Configuration />;
            break;
        default:
            // Home page
            pageComponent = (
                <div className="App">
                    <h1 className="">Luna AI</h1>
                    <p>Configure your AI assistant</p>

                    <button onClick={toSettingsPage}>Settings</button>
                    <p> </p>
                    <button onClick={toConfiguration}>Configuration</button>
                </div>
            );
    }

    return pageComponent;
}

export default App;
