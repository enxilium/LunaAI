import React from "react";
import SettingsPage from "./pages/SettingsPage";
import Configuration from "./pages/Configuration";
import "./styles/globals.css";
import { useState } from "react";

function App() {
    const [page, setPage] = useState("");

    const toSettingsPage = () => {
        setPage("settings");
    };

    const toConfiguration = () => {
        setPage("configuration");
    };

    const toHomePage = () => {
        setPage("");
    };

    let pageComponent;

    switch (page) {
        case "settings":
            pageComponent = <SettingsPage goBack={toHomePage} />;
            break;
        case "configuration":
            pageComponent = <Configuration goBack={toHomePage} />;
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
