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
        this.mcpFunctionDeclarations = [];
        this.mcpToolHandlers = new Map();
        this.mcpService = null;

        // Map to store original function names to standardized camelCase names
        this.originalToStandardizedNames = new Map();
    }

    /**
     * Converts a function name with hyphens or underscores to camelCase
     * @param {string} name - The original function name
     * @returns {string} - The camelCase function name
     */
    standardizeFunctionName(name) {
        if (!name || typeof name !== "string") return name;

        // Replace hyphens and underscores with spaces, then convert to camelCase
        return name.replace(/[-_]([a-z])/g, (match, group) => {
            return group.toUpperCase();
        });
    }

    /**
     * Validates a function declaration to ensure it meets the Gemini API requirements
     * @param {Object} declaration - The function declaration to validate
     * @returns {Object} - A valid function declaration object
     */
    validateFunctionDeclaration(declaration) {
        // Store the original declaration for use when calling the tool
        const originalDeclaration = JSON.parse(JSON.stringify(declaration));

        // Standardize the function name to camelCase
        const originalName = declaration.name || "unknown_function";
        const standardizedName = this.standardizeFunctionName(originalName);

        // Store the mapping from original to standardized name
        this.originalToStandardizedNames.set(originalName, standardizedName);

        console.log(
            `Standardizing function name: ${originalName} → ${standardizedName}`
        );

        // Ensure the declaration has required fields
        const validDeclaration = {
            name: standardizedName,
            description: declaration.description || `Function: ${originalName}`,
            // Store the original declaration as metadata
            _originalDeclaration: originalDeclaration,
        };

        // Only add parameters if the function actually needs them
        if (declaration.parameters) {
            // Process the parameters schema recursively
            validDeclaration.parameters = this.processSchema(
                declaration.parameters
            );
        } else {
            // If no parameters, use an empty object schema
            validDeclaration.parameters = {
                type: "object",
                properties: {},
            };
        }

        return validDeclaration;
    }

    /**
     * Recursively processes a schema object to ensure it meets Gemini API requirements
     * @param {Object} schema - The schema object to process
     * @returns {Object} - A valid schema object
     */
    processSchema(schema) {
        if (!schema || typeof schema !== "object") {
            return { type: "object", properties: {} };
        }

        const validSchema = {
            type: schema.type || "object",
        };

        // Copy description if it exists
        if (schema.description) {
            validSchema.description = schema.description;
        }

        // Process properties if they exist
        if (schema.properties && typeof schema.properties === "object") {
            validSchema.properties = {};

            for (const [key, prop] of Object.entries(schema.properties)) {
                if (!prop) continue;

                validSchema.properties[key] = {
                    type: prop.type || "string",
                };

                // Copy description if it exists
                if (prop.description) {
                    validSchema.properties[key].description = prop.description;
                }

                // Special handling for known problematic fields
                if (key === "attendees" && prop.type === "array") {
                    // Simplify attendees to just be an array of strings
                    validSchema.properties[key] = {
                        type: "array",
                        description:
                            prop.description ||
                            "List of attendee email addresses",
                        items: {
                            type: "string",
                            description: "Email address of the attendee",
                        },
                    };
                    continue;
                }

                // Special handling for properties.title in API-post-page
                if (
                    key === "properties" &&
                    prop.type === "object" &&
                    prop.properties &&
                    prop.properties.title &&
                    prop.properties.title.type === "array"
                ) {
                    // Ensure the title array has an items field
                    validSchema.properties[key] = {
                        type: "object",
                        description: prop.description || "Page properties",
                        properties: {
                            title: {
                                type: "array",
                                description: "Title of the page",
                                items: {
                                    type: "object",
                                    properties: {
                                        text: {
                                            type: "object",
                                            properties: {
                                                content: {
                                                    type: "string",
                                                    description: "Text content",
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            type: {
                                type: "string",
                                description: "Type of the property",
                            },
                        },
                        required: prop.required || [],
                    };
                    continue;
                }

                // Special handling for reminders.overrides
                if (
                    key === "reminders" &&
                    prop.type === "object" &&
                    prop.properties &&
                    prop.properties.overrides &&
                    prop.properties.overrides.type === "array"
                ) {
                    // Ensure the overrides array has an items field
                    validSchema.properties[key] = {
                        type: "object",
                        description:
                            prop.description ||
                            "Reminder settings for the event",
                        properties: {
                            useDefault: {
                                type: "boolean",
                                description:
                                    prop.properties.useDefault?.description ||
                                    "Whether to use the default reminders",
                            },
                            overrides: {
                                type: "array",
                                description:
                                    prop.properties.overrides?.description ||
                                    "Custom reminders",
                                items: {
                                    type: "object",
                                    properties: {
                                        method: {
                                            type: "string",
                                            description:
                                                "The method used to deliver the reminder",
                                        },
                                        minutes: {
                                            type: "integer",
                                            description:
                                                "Minutes before the event to trigger the reminder",
                                        },
                                    },
                                },
                            },
                        },
                    };

                    if (prop.required && Array.isArray(prop.required)) {
                        validSchema.properties[key].required = [
                            ...prop.required,
                        ];
                    }

                    continue;
                }

                // For array types, ensure they have an items field and process it recursively
                if (prop.type === "array") {
                    if (prop.items && typeof prop.items === "object") {
                        // Simplify complex nested objects in arrays to avoid validation issues
                        if (
                            prop.items.type === "object" &&
                            prop.items.properties
                        ) {
                            // For complex object items, simplify to string items if possible
                            const hasSimpleStructure =
                                Object.keys(prop.items.properties).length === 1;

                            if (hasSimpleStructure) {
                                const singlePropKey = Object.keys(
                                    prop.items.properties
                                )[0];
                                const singleProp =
                                    prop.items.properties[singlePropKey];

                                // If the object just wraps a single string property, use string items
                                if (singleProp.type === "string") {
                                    validSchema.properties[key].items = {
                                        type: "string",
                                        description:
                                            singleProp.description ||
                                            `${singlePropKey} value`,
                                    };
                                    continue;
                                }
                            }

                            // Otherwise, process recursively but keep it simple
                            validSchema.properties[key].items = {
                                type: "object",
                                properties: {},
                            };

                            // Add only essential properties
                            for (const [subKey, subProp] of Object.entries(
                                prop.items.properties
                            )) {
                                validSchema.properties[key].items.properties[
                                    subKey
                                ] = {
                                    type: subProp.type || "string",
                                };

                                if (subProp.description) {
                                    validSchema.properties[
                                        key
                                    ].items.properties[subKey].description =
                                        subProp.description;
                                }
                            }
                        } else {
                            // For non-object items, process recursively
                            validSchema.properties[key].items =
                                this.processSchema(prop.items);
                        }
                    } else {
                        // Default to string items if not specified
                        validSchema.properties[key].items = { type: "string" };
                    }
                }

                // For object types, process their properties recursively
                if (prop.type === "object" && prop.properties) {
                    validSchema.properties[key].properties = {};

                    for (const [subKey, subProp] of Object.entries(
                        prop.properties
                    )) {
                        validSchema.properties[key].properties[subKey] =
                            this.processSchema(subProp);
                    }

                    // Copy required fields if they exist
                    if (prop.required && Array.isArray(prop.required)) {
                        validSchema.properties[key].required = [
                            ...prop.required,
                        ];
                    }
                }

                // Handle enum property - special case for number/integer types with enum
                if (prop.enum) {
                    // For number/integer types with enum, convert the type to string
                    // since Gemini API only allows enum for string types
                    if (prop.type === "number" || prop.type === "integer") {
                        console.log(
                            `Converting ${key} from ${prop.type} to string because it has an enum property`
                        );
                        validSchema.properties[key].type = "string";
                    }

                    // Convert all enum values to strings as required by Gemini API
                    validSchema.properties[key].enum = prop.enum.map((val) =>
                        String(val)
                    );
                }

                // Only include format property if it's valid for the type
                // For string types, only 'enum' is allowed as a format in Gemini API
                if (prop.format) {
                    // For string type, we'll omit the format property unless it's 'enum'
                    if (prop.type === "string" && prop.format !== "enum") {
                        // Skip adding the format property
                        console.log(
                            `Removing unsupported format '${prop.format}' from string parameter`
                        );
                    } else {
                        validSchema.properties[key].format = prop.format;
                    }
                }

                // Handle minimum and maximum for number/integer types
                if (
                    (prop.type === "number" || prop.type === "integer") &&
                    (prop.minimum !== undefined || prop.maximum !== undefined)
                ) {
                    if (prop.minimum !== undefined) {
                        validSchema.properties[key].minimum = prop.minimum;
                    }
                    if (prop.maximum !== undefined) {
                        validSchema.properties[key].maximum = prop.maximum;
                    }
                }

                // Handle pattern for string types (as an alternative to format)
                if (prop.type === "string" && prop.pattern) {
                    validSchema.properties[key].pattern = prop.pattern;
                }
            }
        }

        // Copy required fields if they exist
        if (schema.required && Array.isArray(schema.required)) {
            validSchema.required = [...schema.required];
        }

        return validSchema;
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
                            type: "object",
                            properties: {},
                        },
                    };

                    // Validate the declaration
                    const validDeclaration =
                        this.validateFunctionDeclaration(declaration);
                    functionDeclarations.push(validDeclaration);
                } else {
                    console.warn(
                        `Command ${name} exists but has no definition in internalTools`
                    );
                    // Add a default definition with validation
                    const defaultDeclaration = {
                        name,
                        description: `Internal tool: ${name}`,
                        parameters: { type: "object", properties: {} },
                    };
                    functionDeclarations.push(
                        this.validateFunctionDeclaration(defaultDeclaration)
                    );
                }
            }

            this.internalTools = { functionDeclarations };
            this.internalToolSet = new Set(commandNames);
        } catch (error) {
            console.error("Error processing internal tools:", error);
            return { success: false };
        }

        const mcpClients = await this.mcpService.getAllClients();

        // Process MCP clients and their tools
        if (mcpClients.length > 0) {
            for (const client of mcpClients) {
                try {
                    // Get tools directly from the client
                    const toolsResponse = await client.listTools();
                    // Extract the tools array from the response
                    const tools =
                        toolsResponse && toolsResponse.tools
                            ? toolsResponse.tools
                            : [];

                    if (!Array.isArray(tools)) {
                        console.warn(
                            "Invalid tools structure, expected array:",
                            tools
                        );
                        continue;
                    }

                    console.log(
                        `Processing ${tools.length} tools from MCP client`
                    );

                    for (const tool of tools) {
                        // More robust error checking for tool structure
                        if (!tool || typeof tool !== "object") {
                            console.warn("Invalid tool object:", tool);
                            continue;
                        }

                        const originalName =
                            tool.name || `unknown_tool_${Date.now()}`;
                        const description =
                            tool.description &&
                            typeof tool.description === "string"
                                ? tool.description
                                : `Tool from MCP: ${originalName}`;

                        // Extract parameters from inputSchema
                        let parameters = { type: "object", properties: {} };
                        if (
                            tool.inputSchema &&
                            typeof tool.inputSchema === "object"
                        ) {
                            parameters = tool.inputSchema;
                        }

                        // Remove unsupported properties from the parameters
                        if (parameters.$defs) {
                            delete parameters.$defs;
                        }

                        // Remove nullable fields from properties
                        if (parameters.properties) {
                            for (const key in parameters.properties) {
                                if (parameters.properties[key].nullable) {
                                    delete parameters.properties[key].nullable;
                                }
                            }
                        }

                        // Create a valid function declaration with safe defaults
                        const functionDeclaration = {
                            name: originalName,
                            description,
                            parameters: parameters || {
                                type: "object",
                                properties: {},
                            },
                        };

                        // Validate the declaration - this will standardize the name
                        const validDeclaration =
                            this.validateFunctionDeclaration(
                                functionDeclaration
                            );

                        this.mcpFunctionDeclarations.push(validDeclaration);

                        // Store the handler with the ORIGINAL name, not the standardized one
                        // This is crucial because the MCP client expects the original name
                        this.mcpToolHandlers.set(originalName, client);

                        console.log(
                            `Registered MCP tool: ${originalName} → ${validDeclaration.name}`
                        );
                    }
                } catch (error) {
                    console.error("Error processing MCP client tools:", error);
                }
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
            const allDeclarations = [
                ...this.internalTools.functionDeclarations,
                ...this.mcpFunctionDeclarations,
            ];

            // Final validation of all declarations before creating the session
            // Note: We don't need to re-validate here as the names are already standardized
            const validatedDeclarations = allDeclarations;

            const allTools =
                validatedDeclarations.length > 0
                    ? [{ functionDeclarations: validatedDeclarations }]
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

            const internalToolCalls = [];
            const mcpToolCalls = [];

            for (const call of message.toolCall.functionCalls) {
                // The name received from Gemini will be the standardized (camelCase) name
                // We need to check if it's an internal tool or MCP tool
                if (this.internalToolSet.has(call.name)) {
                    internalToolCalls.push(call);
                } else {
                    // For MCP tools, we need to find the original name
                    // First, check if this standardized name exists in our MCPs
                    if (this.mcpToolHandlers.has(call.name)) {
                        mcpToolCalls.push(call);
                    } else {
                        // If not found directly, it might be because we're using the standardized name
                        // but the handler is registered with the original name
                        let found = false;
                        for (const [
                            originalName,
                            standardizedName,
                        ] of this.originalToStandardizedNames.entries()) {
                            if (
                                standardizedName === call.name &&
                                this.mcpToolHandlers.has(originalName)
                            ) {
                                // Create a modified call object with the original name
                                const modifiedCall = {
                                    ...call,
                                    originalName: originalName,
                                };
                                mcpToolCalls.push(modifiedCall);
                                found = true;
                                break;
                            }
                        }

                        if (!found) {
                            console.warn(`Unknown tool called: ${call.name}`);
                        }
                    }
                }
            }

            const functionResponses = [];

            // Handle internal tools
            for (const call of internalToolCalls) {
                const result = await executeCommand({
                    name: call.name,
                    args: call.args,
                });

                functionResponses.push({
                    id: call.id,
                    name: call.name,
                    response: {
                        result: result,
                        scheduling: FunctionResponseScheduling.WHEN_IDLE,
                    },
                });
            }

            // Handle MCP tools
            for (const call of mcpToolCalls) {
                try {
                    // Use the original name for looking up the client if available
                    const clientName = call.originalName || call.name;
                    const client = this.mcpToolHandlers.get(clientName);

                    // Find the original tool declaration to get the correct parameter format
                    const toolDeclaration = this.mcpFunctionDeclarations.find(
                        (decl) =>
                            decl.name === call.name ||
                            decl._originalDeclaration.name === clientName
                    );

                    // Use the original parameter format if available
                    const callArgs = call.args;

                    const response = await client.callTool([
                        {
                            // Use the original name when calling the actual tool
                            name: clientName,
                            args: callArgs,
                            id: call.id,
                        },
                    ]);

                    if (response && response.length > 0) {
                        functionResponses.push({
                            id: call.id,
                            name: call.name, // Use standardized name in response
                            response: {
                                result: response[0].functionResponse.response,
                                scheduling:
                                    FunctionResponseScheduling.WHEN_IDLE,
                            },
                        });
                    }
                } catch (e) {
                    console.error(
                        `Gemini Service: Error calling MCP tool ${call.name}:`,
                        e
                    );
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
}

async function getGeminiService() {
    if (!geminiService) {
        geminiService = new GeminiService();
        await geminiService.initialize();
    }
    return geminiService;
}

module.exports = { getGeminiService };
