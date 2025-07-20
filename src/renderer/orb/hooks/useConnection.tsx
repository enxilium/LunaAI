"use client";

import React, { createContext, useContext } from "react";

type ConnectionData = {
    // Empty for now - this will be used for Google ADK integration
};

const ConnectionContext = createContext<ConnectionData | undefined>(undefined);

export const ConnectionProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const contextValue: ConnectionData = {
        // Empty for now - this will be populated with ADK functionality
    };

    return (
        <ConnectionContext.Provider value={contextValue}>
            {children}
        </ConnectionContext.Provider>
    );
};

export const useConnection = () => {
    const context = useContext(ConnectionContext);
    if (context === undefined) {
        throw new Error(
            "useConnection must be used within a ConnectionProvider"
        );
    }
    return context;
};
