/**
 * Simple Asset Service for Luna AI
 * Builds on existing IPC approach with minimal caching
 */

class SimpleAssetService {
    private cache = new Map<string, string>();

    /**
     * Get an asset via IPC with simple caching
     */
    async getAsset(type: string, name: string): Promise<string> {
        const cacheKey = `${type}:${name}`;

        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        try {
            // Use existing IPC mechanism
            const result = await window.electron.getAsset(type, name);

            // Cache the result
            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error(
                `[AssetService] Failed to get ${type}/${name}:`,
                error
            );
            throw error;
        }
    }

    /**
     * Convenience methods for specific asset types
     */
    getImage(name: string): Promise<string> {
        return this.getAsset("images", name);
    }

    getModel(name: string): Promise<string> {
        return this.getAsset("models", name);
    }

    getKey(name: string): Promise<string> {
        return this.getAsset("key", name);
    }

    getFont(name: string): Promise<string> {
        return this.getAsset("fonts", name);
    }

    /**
     * Clear cache if needed
     */
    clearCache(): void {
        this.cache.clear();
    }
}

// Singleton instance
let assetService: SimpleAssetService | null = null;

export function getAssetService(): SimpleAssetService {
    if (!assetService) {
        assetService = new SimpleAssetService();
    }
    return assetService;
}
