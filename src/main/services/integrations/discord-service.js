class DiscordService {
    constructor(credentialsService) {
        this.credentialsService = credentialsService;
        this.clientId = null;
        this.clientSecret = null;
    }

    async initialize() {
        this.clientId = await this.credentialsService.getCredentials(
            "discord-client-id"
        );
        this.clientSecret = await this.credentialsService.getCredentials(
            "discord-client-secret"
        );
    }
}

// TODO: Implement Discord Service. Should cover guilds, channels, and messages.
