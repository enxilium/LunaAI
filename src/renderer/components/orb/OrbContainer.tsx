import React from "react";
import { useEffect } from "react";

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

export default OrbContainer;
