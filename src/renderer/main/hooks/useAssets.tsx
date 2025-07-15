import { useState, useEffect, useCallback } from "react";
import { getKeyService } from "../services/key-service";

/**
 * Hook for key/credential management only
 * Static assets (models, images, fonts) are now handled directly via webpack
 */
export function useKeys() {
    const keyService = getKeyService();

    const getKey = useCallback(
        (name: string) => keyService.getKey(name),
        [keyService]
    );

    return {
        getKey,
        clearCache: () => keyService.clearCache(),
    };
}

/**
 * Hook for getting a specific key with loading state
 */
export function useKey(name: string) {
    const [key, setKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const { getKey } = useKeys();

    useEffect(() => {
        let mounted = true;

        const loadKey = async () => {
            setLoading(true);

            const result = await getKey(name);

            if (mounted) {
                setKey(result);
                setLoading(false);
            }
        };

        loadKey();

        return () => {
            mounted = false;
        };
    }, [name, getKey]);

    return { key, loading };
}
