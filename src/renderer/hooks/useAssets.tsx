import { useState, useEffect, useCallback } from "react";
import { getAssetService } from "../services/asset-service";

/**
 * Simple hook for asset management - builds on existing IPC approach
 */
export function useAssets() {
    const assetService = getAssetService();

    const getAsset = useCallback(
        async (type: string, name: string): Promise<string> => {
            return assetService.getAsset(type, name);
        },
        [assetService]
    );

    // Convenience methods
    const getImage = useCallback(
        (name: string) => assetService.getImage(name),
        [assetService]
    );
    const getModel = useCallback(
        (name: string) => assetService.getModel(name),
        [assetService]
    );
    const getKey = useCallback(
        (name: string) => assetService.getKey(name),
        [assetService]
    );
    const getFont = useCallback(
        (name: string) => assetService.getFont(name),
        [assetService]
    );

    return {
        getAsset,
        getImage,
        getModel,
        getKey,
        clearCache: () => assetService.clearCache(),
    };
}

/**
 * Hook for getting a specific asset with loading state
 */
export function useAsset(type: string, name: string) {
    const [asset, setAsset] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const { getAsset } = useAssets();

    useEffect(() => {
        let mounted = true;

        const loadAsset = async () => {
            try {
                setLoading(true);
                setError(null);

                const result = await getAsset(type, name);

                if (mounted) {
                    setAsset(result);
                }
            } catch (err) {
                if (mounted) {
                    setError(
                        err instanceof Error ? err : new Error("Unknown error")
                    );
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        loadAsset();

        return () => {
            mounted = false;
        };
    }, [type, name, getAsset]);

    return { asset, loading, error };
}
