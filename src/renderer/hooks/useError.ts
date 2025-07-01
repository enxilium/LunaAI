import { useCallback } from "react";

/**
 * @description Custom hook for handling and reporting errors.
 * @returns {{
 * reportError: (error: Error | string, source: string) => void;
 * }}
 */
export default function useError() {
    const reportError = useCallback((error: Error | string, source: string) => {
        const message = error instanceof Error ? error.message : error;

        if (window.electron) {
            window.electron.reportError(message, source);
        } else {
            // Fallback for non-electron environments
            console.error(`[${source}]: ${message}`);
        }
    }, []);

    return { reportError };
}
