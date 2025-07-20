import { useState, useCallback } from "react";

export const useMouseControl = () => {
    const [isControlling, setIsControlling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const controlMouse = useCallback(
        async (params: {
            action:
                | "click"
                | "move"
                | "scroll"
                | "doubleclick"
                | "drag"
                | "release";
            x?: number;
            y?: number;
            button?: "left" | "right" | "middle";
            scrollDirection?: "up" | "down";
            scroll_amount?: number;
            reasoning?: string;
        }): Promise<{
            success: boolean;
            message: string;
            action?: string;
            coordinates?: { x: number; y: number };
            button?: string;
        }> => {
            setError(null);
            setIsControlling(true);

            try {
                const result = await window.electron.controlMouse(params);

                if (!result.success) {
                    throw new Error(result.message);
                }

                setIsControlling(false);
                return result;
            } catch (err) {
                const errorMessage =
                    err instanceof Error ? err.message : String(err);
                console.error("Error controlling mouse:", errorMessage);
                setError(errorMessage);
                setIsControlling(false);
                return {
                    success: false,
                    message: errorMessage,
                };
            }
        },
        []
    );

    const clickAt = useCallback(
        async (
            x: number,
            y: number,
            button: "left" | "right" | "middle" = "left"
        ) => {
            return await controlMouse({ action: "click", x, y, button });
        },
        [controlMouse]
    );

    const moveTo = useCallback(
        async (x: number, y: number) => {
            return await controlMouse({ action: "move", x, y });
        },
        [controlMouse]
    );

    const scrollAt = useCallback(
        async (x: number, y: number, direction: "up" | "down" = "up") => {
            return await controlMouse({
                action: "scroll",
                x,
                y,
                scrollDirection: direction,
            });
        },
        [controlMouse]
    );

    const doubleClickAt = useCallback(
        async (
            x: number,
            y: number,
            button: "left" | "right" | "middle" = "left"
        ) => {
            return await controlMouse({ action: "doubleclick", x, y, button });
        },
        [controlMouse]
    );

    const startDrag = useCallback(
        async (
            x: number,
            y: number,
            button: "left" | "right" | "middle" = "left"
        ) => {
            return await controlMouse({ action: "drag", x, y, button });
        },
        [controlMouse]
    );

    const releaseDrag = useCallback(
        async (button: "left" | "right" | "middle" = "left") => {
            return await controlMouse({ action: "release", button });
        },
        [controlMouse]
    );

    return {
        isControlling,
        error,
        controlMouse,
        clickAt,
        moveTo,
        scrollAt,
        doubleClickAt,
        startDrag,
        releaseDrag,
    };
};
