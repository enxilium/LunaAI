const {
    GoogleGenAI,
    Modality,
    FunctionResponseScheduling,
} = require("@google/genai");
const { ipcMain } = require("electron");
const { getEventsService } = require("../events-service");
const { getGeminiConfig } = require("../../invokes/get-asset");
const { getCredentialsService } = require("../user/credentials-service");
const { getMcpService } = require("./mcp-service");
const { SimpleMcpToolMapper } = require("./simple-mcp-tool-mapper");
const { executeCommand } = require("../../invokes/execute-command");
const { getErrorService } = require("../error-service");
const commands = require("../../commands");
const fs = require("fs");
const path = require("path");

let geminiService = null;

class GeminiService {
    constructor() {
        this.session = null;
        this.client = null;
        this.eventsService = null;

        this.speechConfig = null;
        this.systemInstruction = null;
        this.internalTools = null;
        this.internalToolSet = null;
        this.mcpService = null;

        // Initialize the MCP tool mapper
        this.mcpToolMapper = new SimpleMcpToolMapper();
        this.errorService = getErrorService();
    }

    async initialize() {
        this.eventsService = await getEventsService();
        this.mcpService = await getMcpService();

        const apiKey = await getCredentialsService().getCredentials(
            "gemini-key"
        );

        const { systemInstruction, internalTools, speechConfig } =
            await getGeminiConfig();
        this.speechConfig = speechConfig;
        this.systemInstruction = systemInstruction;

        // Ensure internalTools exists before using it
        if (!internalTools) {
            this.errorService.reportError(
                "internalTools is undefined in config",
                "gemini-service"
            );
            return { success: false };
        }

        // Create function declarations for internal tools
        try {
            const commandNames = Object.keys(commands);
            const functionDeclarations = [];

            for (const name of commandNames) {
                // Check if the tool exists in internalTools
                if (internalTools[name]) {
                    const declaration = {
                        name,
                        description:
                            internalTools[name].description ||
                            `Internal tool: ${name}`,
                        parameters: internalTools[name].parameters || {
                            type: "OBJECT",
                            properties: {},
                        },
                    };

                    // Clean enum properties from internal tools for Gemini API compliance
                    this.cleanInternalToolDeclaration(declaration);

                    // Internal tools don't need validation from MCP validator
                    // They're handled directly by the internal tool system
                    functionDeclarations.push(declaration);
                } else {
                    console.warn(
                        `Command ${name} exists but has no definition in internalTools`
                    );
                    // Add a default definition with validation
                    const defaultDeclaration = {
                        name,
                        description: `Internal tool: ${name}`,
                        parameters: { type: "OBJECT", properties: {} },
                    };
                    // Internal tools don't need validation from MCP validator
                    // They're handled directly by the internal tool system
                    functionDeclarations.push(defaultDeclaration);
                }
            }

            this.internalTools = { functionDeclarations };
            this.internalToolSet = new Set(commandNames);
        } catch (error) {
            this.errorService.reportError(`Error processing internal tools: ${error.message}`, "gemini-service");
            return { success: false };
        }

        const mcpClients = await this.mcpService.getAllClients();

        // Process MCP clients and their tools using the new tool mapper
        if (mcpClients.length > 0) {
            console.log(`[Gemini Service] Processing ${mcpClients.length} MCP clients`);

            const serverConfigs = this.mcpService.getServerConfigs();

            for (let i = 0; i < mcpClients.length; i++) {
                const client = mcpClients[i];
                const serverConfig = serverConfigs[i];

                try {
                    // Get tools directly from the client
                    const toolsResponse = await client.listTools();
                    const tools =
                        toolsResponse && toolsResponse.tools
                            ? toolsResponse.tools
                            : [];

                    if (!Array.isArray(tools)) {
                        console.warn(
                            `Invalid tools structure from ${serverConfig.name}, expected array:`,
                            tools
                        );
                        continue;
                    }

                    console.log(
                        `[Gemini Service] Processing ${tools.length} tools from ${serverConfig.name}`
                    );

                    // Register tools with the mapper
                    await this.mcpToolMapper.registerMcpTools(
                        client,
                        serverConfig.name,
                        tools
                    );
                } catch (error) {
                    this.errorService.reportError(
                        `Error processing MCP client ${serverConfig.name}: ${error.message}`,
                        "gemini-service"
                    );
                }
            }

            console.log(`[Gemini Service] MCP Tool Mapper initialized with ${this.mcpToolMapper.getDebugInfo().totalHandlers} handlers`);
        }

        if (
            !apiKey ||
            !this.systemInstruction ||
            !this.internalTools ||
            !this.speechConfig
        ) {
            this.errorService.reportError(
                "Missing initialization parameters",
                "gemini-service"
            );
            return { success: false };
        }

        this.client = new GoogleGenAI({ apiKey });

        ipcMain.handle("gemini:start-session", () => this.startSession());

        ipcMain.on("gemini:audio-data", (event, audioData) =>
            this.sendAudioData(audioData)
        );

        ipcMain.handle("gemini:close-session", () => this.closeSession());
    }

    async startSession() {
        if (this.session) {
            return { success: true };
        }

        try {
            console.log("[Gemini Service] Starting session...");

            // Create a combined tool set for Gemini
            const mcpHandlerDeclarations =
                this.mcpToolMapper.getHandlerDeclarations();
            const allDeclarations = [
                ...this.internalTools.functionDeclarations,
                ...mcpHandlerDeclarations,
            ];

            console.log(
                `[Gemini Service] Created ${allDeclarations.length} function declarations (${this.internalTools.functionDeclarations.length} internal, ${mcpHandlerDeclarations.length} MCP)`
            );

            const allTools =
                allDeclarations.length > 0
                    ? [{ functionDeclarations: allDeclarations }]
                    : [];

            // Save tools configuration to temporary file for debugging
            try {
                fs.writeFileSync(
                    path.join(
                        process.cwd(),
                        "assets",
                        "config",
                        "all-tools.json"
                    ),
                    JSON.stringify(allTools, null, 4)
                );
                console.log("[Gemini Service] Saved tools configuration to all-tools.json");
            } catch (error) {
                this.errorService.reportError(`Failed to save tools configuration: ${error.message}`, "gemini-service");
            }

            this.session = await this.client.live.connect({
                model: "gemini-live-2.5-flash-preview",
                callbacks: {
                    onopen: () => {
                        console.log("[Gemini Service] Session opened");
                        this.eventsService.sendToRenderer(
                            "orb",
                            "gemini:session-opened"
                        );
                    },
                    onmessage: (message) => this.handleMessage(message),
                    onerror: (e) => {
                        this.errorService.reportError(`Session error: ${e.message}`, "gemini-service");
                        this.eventsService.sendToRenderer(
                            "orb",
                            "gemini:error",
                            e.message
                        );
                    },
                    onclose: (e) => {
                        console.log("[Gemini Service] Session closed:", e.reason);
                        this.eventsService.sendToRenderer(
                            "orb",
                            "gemini:closed",
                            e.reason
                        );
                        this.session = null;
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: this.systemInstruction,
                    speechConfig: this.speechConfig,
                    tools: allTools,
                },
            });
            return { success: true };
        } catch (e) {
            this.errorService.reportError(`Failed to connect session: ${e.message}`, "gemini-service");
            this.eventsService.sendToRenderer("orb", "gemini:error", e.message);
            return { success: false, error: e.message };
        }
    }

    async handleMessage(message) {
        if (message.serverContent?.interrupted) {
            this.eventsService.sendToRenderer("orb", "gemini:interrupted");
            return;
        }

        const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData;
        if (audio?.data) {
            this.eventsService.sendToRenderer(
                "orb",
                "gemini:audio-chunk",
                audio.data
            );
        }

        if (message.toolCall) {
            console.log("[Gemini Service] Tool call received");

            const functionResponses = [];

            for (const call of message.toolCall.functionCalls) {
                try {
                    let result;

                    // Check if it's an internal tool
                    if (this.internalToolSet.has(call.name)) {
                        result = await executeCommand({
                            name: call.name,
                            args: call.args,
                        });
                    }
                    // Check if it's an MCP handler
                    else if (this.mcpToolMapper.isHandler(call.name)) {
                        result = await this.mcpToolMapper.executeHandler(
                            call.name,
                            call.args
                        );
                    } else {
                        result = `Error: Unknown tool ${call.name}`;
                    }

                    functionResponses.push({
                        id: call.id,
                        name: call.name,
                        response: {
                            result: result,
                            scheduling: FunctionResponseScheduling.WHEN_IDLE,
                        },
                    });
                } catch (error) {
                    this.errorService.reportError(
                        `Error executing tool ${call.name}: ${error.message}`,
                        "gemini-service"
                    );

                    functionResponses.push({
                        id: call.id,
                        name: call.name,
                        response: {
                            result: `Error executing ${call.name}: ${error.message}`,
                            scheduling: FunctionResponseScheduling.WHEN_IDLE,
                        },
                    });
                }
            }

            if (this.session && functionResponses.length > 0) {
                console.log("[Gemini Service] Tool responses sent");
                this.session.sendToolResponse({
                    functionResponses,
                });
            }
        }
    }

    sendAudioData(audioData) {
        if (this.session) {
            this.session.sendRealtimeInput({
                audio: {
                    data: audioData,
                    mimeType: "audio/pcm;rate=16000",
                },
            });
        }
    }

    closeSession() {
        if (this.session) {
            console.log("[Gemini Service] Closing session");
            this.session.close();
            this.session = null;
            return { success: true };
        }
        return { success: false };
    }

    // Clean internal tool declarations for Gemini API compliance
    // Note: Enum fields are now supported by Gemini API, so we preserve them
    cleanInternalToolDeclaration(declaration) {
        if (declaration.parameters?.properties) {
            const properties = declaration.parameters.properties;

            // Ensure enum values are strings (as required by Gemini API)
            for (const key in properties) {
                const property = properties[key];
                if (property.enum) {
                    // Ensure enum values are strings
                    property.enum = property.enum.map((value) => {
                        return typeof value === "string"
                            ? value
                            : String(value);
                    });
                }

                // Handle format field - Only preserve "enum" format, remove others
                // Gemini API only supports format: "enum"
                if (property.format && property.format !== "enum") {
                    delete property.format;
                }

                // Clean up any unsupported properties but preserve enum and format
                const unsupportedProps = [
                    "minimum",
                    "maximum",
                    "minLength",
                    "maxLength",
                    "minItems",
                    "maxItems",
                    "minProperties",
                    "maxProperties",
                ];
                unsupportedProps.forEach((prop) => {
                    if (property.hasOwnProperty(prop)) {
                        delete property[prop];
                    }
                });
            }
        }
    }
}

async function getGeminiService() {
    if (!geminiService) {
        geminiService = new GeminiService();
        await geminiService.initialize();
    }
    return geminiService;
}

module.exports = { getGeminiService };
