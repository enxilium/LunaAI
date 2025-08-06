import { createRoot } from "react-dom/client";
import OrbContainer from "./components/OrbContainer";
import "./styles/globals.css";
import React from "react";

const container = document.getElementById("orb-root");
const root = createRoot(container!);

// Grant permissions before rendering
root.render(<OrbContainer />);
