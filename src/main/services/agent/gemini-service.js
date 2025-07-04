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
const {
    StartupMcpValidator,
} = require("../../validation/startup-mcp-validator");
const { executeCommand } = require("../../invokes/execute-command");
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
        this.startupValidator = new StartupMcpValidator();
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
            console.error(
                "Gemini Service: internalTools is undefined in config"
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
            console.error("Error processing internal tools:", error);
            return { success: false };
        }

        const mcpClients = await this.mcpService.getAllClients();

        // Process MCP clients and their tools using the new tool mapper
        if (mcpClients.length > 0) {
            console.log(
                `Gemini Service: Processing ${mcpClients.length} MCP clients`
            );

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
                        `Gemini Service: Processing ${tools.length} tools from ${serverConfig.name}`
                    );

                    // Register tools with the mapper
                    await this.mcpToolMapper.registerMcpTools(
                        client,
                        serverConfig.name,
                        tools
                    );
                } catch (error) {
                    console.error(
                        `Gemini Service: Error processing MCP client ${serverConfig.name}:`,
                        error
                    );
                }
            }

            // Get debug info
            const debugInfo = this.mcpToolMapper.getDebugInfo();
            console.log(
                "Gemini Service: MCP Tool Mapper Debug Info:",
                debugInfo
            );

            // Run comprehensive validation on all registered MCP tools
            console.log("Gemini Service: Running REAL MCP tool validation...");
            try {
                const validationResult =
                    await this.startupValidator.validateMcpToolMapper(
                        this.mcpToolMapper
                    );

                if (!validationResult.success) {
                    console.error(
                        "Gemini Service: REAL MCP tool validation failed!"
                    );

                    // Log critical issues but don't fail startup - allow degraded operation
                    if (validationResult.issues) {
                        const criticalIssues = validationResult.issues.filter(
                            (i) => i.severity === "CRITICAL"
                        );
                        if (criticalIssues.length > 0) {
                            console.error(
                                "Critical validation issues with REAL MCP tools:"
                            );
                            criticalIssues.forEach((issue) =>
                                console.error(`  - ${issue.message}`)
                            );
                        }
                    }
                } else {
                    console.log(
                        "Gemini Service: ✅ REAL MCP tool validation passed successfully"
                    );
                    if (validationResult.stats) {
                        console.log(
                            `  - Validated ${validationResult.stats.toolsValidated} real tools`
                        );
                        console.log(
                            `  - Tested ${validationResult.stats.fieldsValidated} fields`
                        );
                        console.log(
                            `  - Verified ${validationResult.stats.conversionsValidated} conversions`
                        );
                    }
                }
            } catch (error) {
                console.error(
                    "Gemini Service: REAL MCP validation error:",
                    error
                );
                // Don't fail startup, just log the error
            }
        }

        if (
            !apiKey ||
            !this.systemInstruction ||
            !this.internalTools ||
            !this.speechConfig
        ) {
            console.error("Gemini Service: Missing initialization parameters.");
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
            console.log("Gemini Service: Session already active.");
            return { success: true };
        }

        try {
            console.log("Gemini Service: Starting session...");

            // Create a combined tool set for Gemini
            const mcpHandlerDeclarations =
                this.mcpToolMapper.getHandlerDeclarations();
            const allDeclarations = [
                ...this.internalTools.functionDeclarations,
                ...mcpHandlerDeclarations,
            ];

            console.log(
                `Gemini Service: Created ${allDeclarations.length} total function declarations (${this.internalTools.functionDeclarations.length} internal, ${mcpHandlerDeclarations.length} MCP)`
            );

            // Log each declaration for debugging
            allDeclarations.forEach((decl, index) => {
                console.log(`Declaration ${index}: ${decl.name}`);
                if (decl.parameters?.properties?.attendees) {
                    console.log(
                        `  - Has attendees property:`,
                        JSON.stringify(
                            decl.parameters.properties.attendees,
                            null,
                            2
                        )
                    );
                }
            });

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
                console.log(
                    "Gemini Service: Saved tools configuration to all-tools.json"
                );

                // Debug: Check for problematic properties
                const configStr = JSON.stringify(allTools);
                const formatMatches = configStr.match(/"format":/g);
                const attendeesMatches = configStr.match(/"attendees":/g);

                if (formatMatches) {
                    console.log(
                        `✅ Found ${formatMatches.length} format properties in tools config (supported by Gemini API)`
                    );
                } else {
                    console.log(
                        "📋 No format properties found in tools config"
                    );
                }

                if (attendeesMatches) {
                    console.log(
                        `ℹ️  Found ${attendeesMatches.length} attendees properties in tools config`
                    );
                }

                console.log(
                    `📊 Total function declarations: ${allDeclarations.length}`
                );
            } catch (error) {
                console.error(
                    "Gemini Service: Failed to save tools configuration:",
                    error
                );
            }

            this.session = await this.client.live.connect({
                model: "gemini-live-2.5-flash-preview",
                callbacks: {
                    onopen: () => {
                        console.log("Gemini Service: Session opened.");
                        this.eventsService.sendToRenderer(
                            "orb",
                            "gemini:session-opened"
                        );
                    },
                    onmessage: (message) => this.handleMessage(message),
                    onerror: (e) => {
                        console.error(
                            "Gemini Service: Session error:",
                            e.message
                        );
                        this.eventsService.sendToRenderer(
                            "orb",
                            "gemini:error",
                            e.message
                        );
                    },
                    onclose: (e) => {
                        console.log("session closed:", e.reason);
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
            console.error("Gemini Service: Failed to connect.", e);
            this.eventsService.sendToRenderer("orb", "gemini:error", e.message);
            return { success: false, error: e.message };
        }
    }

    async handleMessage(message) {
        if (message.serverContent?.interrupted) {
            console.log("Gemini Service: Session interrupted.");
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
            console.log(
                "Gemini Service: Received tool call:",
                message.toolCall
            );

            const functionResponses = [];

            for (const call of message.toolCall.functionCalls) {
                try {
                    let result;

                    // Check if it's an internal tool
                    if (this.internalToolSet.has(call.name)) {
                        console.log(
                            `Gemini Service: Executing internal tool: ${call.name}`
                        );
                        result = await executeCommand({
                            name: call.name,
                            args: call.args,
                        });
                    }
                    // Check if it's an MCP handler
                    else if (this.mcpToolMapper.isHandler(call.name)) {
                        console.log(
                            `Gemini Service: Executing MCP handler: ${call.name}`
                        );
                        result = await this.mcpToolMapper.executeHandler(
                            call.name,
                            call.args
                        );
                    } else {
                        console.warn(
                            `Gemini Service: Unknown tool called: ${call.name}`
                        );
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
                    console.error(
                        `Gemini Service: Error executing tool ${call.name}:`,
                        error
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
                console.log(
                    "Gemini Service: Sending tool responses:",
                    functionResponses
                );
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
            console.log("Gemini Service: Closing session.");
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
