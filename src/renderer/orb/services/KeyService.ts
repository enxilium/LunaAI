/**
 * Simple Key Service for Luna AI
 * Handles only credential/key retrieval via IPC
 */

class KeyService {
    private cache = new Map<string, string>();

    /**
     * Get a credential/key via IPC with simple caching
     * Throws errors for centralized handling - does not catch them here
     */
    async getKey(name: string): Promise<string | null> {
        const cacheKey = `key:${name}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        const result = await window.electron.getKey(name);

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
