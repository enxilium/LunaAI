/**
 * Simple Key Service for Luna AI
 * Handles only credential/key retrieval via IPC
 */

class KeyService {
    private cache = new Map<string, string>();

    /**
     * Get a credential/key via IPC with simple caching
     */
    async getKey(name: string): Promise<string | null> {
        const cacheKey = `key:${name}`;

        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        // Use the new dedicated getKey IPC method
        const result = await window.electron.getKey(name);

        // Only cache non-null results
        if (result !== null) {
            this.cache.set(cacheKey, result);
        }
        return result;
    }

    /**
     * Clear cache if needed
     */
    clearCache(): void {
        this.cache.clear();
    }
}

// Singleton instance
let keyService: KeyService | null = null;

export function getKeyService(): KeyService {
    if (!keyService) {
        keyService = new KeyService();
    }
    return keyService;
}
