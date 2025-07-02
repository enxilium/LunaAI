class NotionService {
    constructor(credentialsService) {
        this.credentialsService = credentialsService;
        this.clientId = null;
        this.clientSecret = null;
    }

    async initialize() {
        this.clientId = await this.credentialsService.getCredentials(
            "notion-client-id"
        );
        this.clientSecret = await this.credentialsService.getCredentials(
            "notion-client-secret"
        );
    }
}

// TODO: Implement Notion Service. Should cover database, pages, and blocks.
