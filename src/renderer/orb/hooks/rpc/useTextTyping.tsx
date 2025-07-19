import { useState, useCallback } from "react";

export const useTextTyping = () => {
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const typeText = useCallback(
        async (
            text: string
        ): Promise<{
            success: boolean;
            message: string;
        }> => {
            setError(null);
            setIsTyping(true);

            try {
                // Type the text directly
                const result = await window.electron.typeText(text);

                if (!result.success) {
                    throw new Error(result.message);
                }

                setIsTyping(false);
                return result;
            } catch (err) {
                const errorMessage =
                    err instanceof Error ? err.message : String(err);
                console.error("Error typing text:", errorMessage);
                setError(errorMessage);
                setIsTyping(false);
                return {
                    success: false,
                    message: errorMessage,
                };
            }
        },
        []
    );

    const clearText = useCallback(async (): Promise<{
        success: boolean;
        message: string;
    }> => {
        setError(null);
        setIsTyping(true);

        try {
            // Clear the text field directly
            const result = await window.electron.clearTextField();

            if (!result.success) {
                throw new Error(result.message);
            }

            setIsTyping(false);
            return result;
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : String(err);
            console.error("Error clearing text:", errorMessage);
            setError(errorMessage);
            setIsTyping(false);
            return {
                success: false,
                message: errorMessage,
            };
        }
    }, []);

    return {
        isTyping,
        error,
        typeText,
        clearText,
    };
};
