import { createRoot } from "react-dom/client";
import OrbContainer from "./components/OrbContainer";
import "./styles/globals.css";
import React from "react";
import { ConnectionProvider } from "./hooks/useConnection";

const container = document.getElementById("orb-root");
const root = createRoot(container!);

root.render(
    <ConnectionProvider>
        <OrbContainer />
    </ConnectionProvider>
);
