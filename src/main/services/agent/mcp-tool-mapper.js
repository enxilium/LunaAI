/**
 * MCP Tool Mapper
 *
 * This service creates a mapping between Gemini-compliant handler functions
 * and their corresponding MCP tools, enabling seamless parameter transformation
 * and tool execution.
 */

class McpToolMapper {
    constructor() {
        // Map handler function names to their MCP tool metadata
        this.handlerToMcpMap = new Map();

        // Map MCP client instances to their server names for lookup
        this.clientMap = new Map();

        // Store generated handler functions for Gemini
        this.handlerFunctions = new Map();

        // Store MCP metadata for reversible transformations
        this.mcpMetadataStore = new Map();
    }

    /**
     * Register an MCP client and its tools, generating handler functions
     * @param {Object} client - MCP client instance
     * @param {string} serverName - Name of the MCP server
     * @param {Array} tools - Array of tool definitions from the MCP server
     */
    async registerMcpTools(client, serverName, tools) {
        console.log(
            `MCP Tool Mapper: Registering ${tools.length} tools from ${serverName}`
        );

        // Store client reference
        this.clientMap.set(serverName, client);

        for (const tool of tools) {
            try {
                const handlerName = this.generateHandlerName(
                    serverName,
                    tool.name
                );
                const handlerFunction = this.createHandlerFunction(
                    tool,
                    serverName
                );
                const geminiSchema = this.convertToGeminiSchema(tool);

                // Special handling for Notion tools to add specific guidance
                if (serverName === "notion") {
                    console.log(
                        `MCP Tool Mapper: Processing Notion tool: ${tool.name}`
                    );

                    // Fix for notionPostPage (API-post-page)
                    if (tool.name === "API-post-page") {
                        console.log(
                            `MCP Tool Mapper: Applying post-page schema enhancements`
                        );
                        geminiSchema.description =
                            "Create a page OR add an entry to a database. CRITICAL USAGE PATTERN: 1) Use notionPostSearch to find databases (filter={'value':'database'}) or pages (filter={'value':'page'}). 2) For database entries: use parent={'type':'database_id','database_id':'<db_id_from_search>'} and ensure properties match the database schema. 3) For page children: use parent={'type':'page_id','page_id':'<page_id_from_search>'} with only title property.";

                        // CRITICAL FIX: Update the parent object schema to support both page_id and database_id
                        if (
                            geminiSchema.properties &&
                            geminiSchema.properties.parent
                        ) {
                            geminiSchema.properties.parent = {
                                type: "OBJECT",
                                description:
                                    "Parent object. CRITICAL: Use database_id when adding entries to databases (found via search with filter={'value':'database'}), use page_id when adding pages inside other pages (found via search with filter={'value':'page'}). Do NOT include both - choose ONE based on your intent.",
                                properties: {
                                    page_id: {
                                        type: "STRING",
                                        description:
                                            "Page ID for adding sub-pages to existing pages. Use notionPostSearch with filter={'value':'page','property':'object'} to find page IDs.",
                                    },
                                    database_id: {
                                        type: "STRING",
                                        description:
                                            "Database ID for adding entries to databases. Use notionPostSearch with filter={'value':'database','property':'object'} to find database IDs. REQUIRED when adding to databases.",
                                    },
                                    type: {
                                        type: "STRING",
                                        enum: ["page_id", "database_id"],
                                        description:
                                            "INTERNAL GUIDANCE ONLY: Specify 'database_id' for database entries or 'page_id' for page children. This helps validate your choice but is not sent to the API.",
                                    },
                                },
                                additionalProperties: false,
                            };
                        }

                        // CRITICAL FIX: Update the properties schema to require non-empty properties
                        if (
                            geminiSchema.properties &&
                            geminiSchema.properties.properties
                        ) {
                            console.log(
                                `MCP Tool Mapper: Updating properties schema with minProperties: 1`
                            );
                            geminiSchema.properties.properties.minProperties = 1;
                            geminiSchema.properties.properties.description =
                                'Page properties. CRITICAL: NEVER send an empty object {}. ALWAYS provide at minimum a title property. For database entries, provide properties that match the database schema. For regular pages, provide at minimum a title. Use structure: {"Title": [{"text": {"content": "Your title here"}}]}';

                            // Also add required Title property
                            if (!geminiSchema.properties.properties.required) {
                                geminiSchema.properties.properties.required =
                                    [];
                            }
                            if (
                                !geminiSchema.properties.properties.required.includes(
                                    "Title"
                                )
                            ) {
                                geminiSchema.properties.properties.required.push(
                                    "Title"
                                );
                            }

                            // Also update the overall required fields to make properties mandatory
                            if (
                                geminiSchema.required &&
                                !geminiSchema.required.includes("properties")
                            ) {
                                geminiSchema.required.push("properties");
                            }
                        }
                    }

                    // Fix for notionPatchPage (API-patch-page)
                    if (tool.name === "API-patch-page") {
                        console.log(
                            `MCP Tool Mapper: Applying patch-page schema enhancements`
                        );
                        // CRITICAL FIX: Ensure properties parameter requires minProperties: 1
                        if (
                            geminiSchema.properties &&
                            geminiSchema.properties.properties
                        ) {
                            console.log(
                                `MCP Tool Mapper: Updating patch-page properties schema with minProperties: 1`
                            );
                            geminiSchema.properties.properties.minProperties = 1;
                            geminiSchema.properties.properties.description =
                                (geminiSchema.properties.properties
                                    .description ||
                                    "Page properties to update") +
                                " CRITICAL: NEVER send an empty object {}. ALWAYS provide at least one property to update.";
                        }
                    }

                    // Fix for notionPatchBlockChildren (API-patch-block-children)
                    if (tool.name === "API-patch-block-children") {
                        console.log(
                            `MCP Tool Mapper: Applying patch-block-children schema enhancements`
                        );
                        // CRITICAL FIX: Ensure children array items require "type" property
                        if (
                            geminiSchema.properties &&
                            geminiSchema.properties.children
                        ) {
                            if (
                                geminiSchema.properties.children.type ===
                                    "ARRAY" &&
                                geminiSchema.properties.children.items
                            ) {
                                console.log(
                                    `MCP Tool Mapper: Updating children items to require type property`
                                );
                                // Ensure the children items have a required "type" property
                                if (
                                    !geminiSchema.properties.children.items
                                        .required
                                ) {
                                    geminiSchema.properties.children.items.required =
                                        [];
                                }
                                if (
                                    !geminiSchema.properties.children.items.required.includes(
                                        "type"
                                    )
                                ) {
                                    geminiSchema.properties.children.items.required.push(
                                        "type"
                                    );
                                }

                                // Add type property if not present
                                if (
                                    !geminiSchema.properties.children.items
                                        .properties
                                ) {
                                    geminiSchema.properties.children.items.properties =
                                        {};
                                }
                                if (
                                    !geminiSchema.properties.children.items
                                        .properties.type
                                ) {
                                    geminiSchema.properties.children.items.properties.type =
                                        {
                                            type: "STRING",
                                            description:
                                                "Block type (REQUIRED). Common types: paragraph, heading_1, heading_2, heading_3, bulleted_list_item, numbered_list_item, to_do, toggle, code, quote, callout, divider",
                                            enum: [
                                                "paragraph",
                                                "heading_1",
                                                "heading_2",
                                                "heading_3",
                                                "bulleted_list_item",
                                                "numbered_list_item",
                                                "to_do",
                                                "toggle",
                                                "code",
                                                "quote",
                                                "callout",
                                                "divider",
                                            ],
                                        };
                                }

                                geminiSchema.properties.children.description =
                                    (geminiSchema.properties.children
                                        .description ||
                                        "Array of block objects") +
                                    " CRITICAL: Each block MUST have a 'type' property specifying the block type.";
                            }
                        }
                    }
                }

                // Store the mapping
                this.handlerToMcpMap.set(handlerName, {
                    serverName,
                    originalToolName: tool.name,
                    originalSchema: tool.inputSchema,
                    client,
                    parameterMapping: this.createParameterMapping(
                        tool.inputSchema
                    ),
                    mcpMetadata: this.mcpMetadataStore.get(tool.name) || null,
                });

                // Store the handler function
                this.handlerFunctions.set(handlerName, {
                    name: handlerName,
                    description: tool.description,
                    parameters: geminiSchema,
                    handler: handlerFunction,
                });

                console.log(
                    `MCP Tool Mapper: Registered ${handlerName} -> ${serverName}.${tool.name}`
                );
            } catch (error) {
                console.error(
                    `MCP Tool Mapper: Failed to register tool ${tool.name} from ${serverName}:`,
                    error
                );
            }
        }
    }

    /**
     * Generate a unique handler function name
     * @param {string} serverName - MCP server name
     * @param {string} toolName - Original tool name
     * @returns {string} - Unique handler name
     */
    generateHandlerName(serverName, toolName) {
        // Convert to camelCase and ensure uniqueness
        const camelCaseServer = this.toCamelCase(serverName);
        const camelCaseTool = this.toCamelCase(toolName);
        return `${camelCaseServer}${camelCaseTool
            .charAt(0)
            .toUpperCase()}${camelCaseTool.slice(1)}`;
    }

    /**
     * Convert string to camelCase
     * @param {string} str - Input string
     * @returns {string} - camelCase string
     */
    toCamelCase(str) {
        // Handle API- prefix specifically for Notion MCP tools
        if (str.startsWith("API-")) {
            str = str.substring(4); // Remove 'API-' prefix
        }

        // Split on separators and uppercase boundaries
        const parts = str
            .replace(/([a-z])([A-Z])/g, "$1-$2") // Insert separator before uppercase after lowercase
            .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2") // Handle consecutive caps like XMLHttp -> XML-Http
            .split(/[-_\s]+/)
            .filter((part) => part.length > 0);

        if (parts.length === 0) return str.toLowerCase();

        // First part is lowercase, subsequent parts are title case
        const result =
            parts[0].toLowerCase() +
            parts
                .slice(1)
                .map(
                    (part) =>
                        part.charAt(0).toUpperCase() +
                        part.slice(1).toLowerCase()
                )
                .join("");

        return result;
    }

    /**
     * Create a handler function for a specific MCP tool
     * @param {Object} tool - MCP tool definition
     * @param {string} serverName - MCP server name
     * @returns {Function} - Handler function
     */
    createHandlerFunction(tool, serverName) {
        const handlerName = this.generateHandlerName(serverName, tool.name);

        return async (args) => {
            try {
                console.log(
                    `MCP Tool Mapper: Executing ${handlerName} with args:`,
                    args
                );

                const mcpMapping = this.handlerToMcpMap.get(handlerName);
                if (!mcpMapping) {
                    throw new Error(`No MCP mapping found for ${handlerName}`);
                }

                // Transform Gemini args to MCP format with defaults applied
                const mcpArgs = this.transformArgsToMcp(
                    args,
                    mcpMapping.parameterMapping,
                    mcpMapping.mcpMetadata
                );

                // Log to MCP file for debugging
                this.logToMcpFile(
                    serverName,
                    `Tool call: ${mcpMapping.originalToolName}`,
                    mcpArgs
                );

                console.log(
                    `MCP Tool Mapper: Calling ${mcpMapping.originalToolName} with transformed args:`,
                    mcpArgs
                );

                // Enhanced debugging for MCP calls
                console.log(
                    `MCP Tool Mapper: About to call ${serverName} MCP server...`
                );
                const startTime = Date.now();

                // Temporarily suppress ALL console output to prevent MCP SDK noise
                const originalConsoleError = console.error;
                const originalConsoleWarn = console.warn;
                const originalConsoleLog = console.log;
                const originalConsoleInfo = console.info;
                const originalConsoleDebug = console.debug;

                // TEMPORARILY DISABLE SUPPRESSION FOR DEBUGGING
                // Completely silence all console output during MCP call
                // console.error = () => {};
                // console.warn = () => {};
                // console.log = () => {};
                // console.info = () => {};
                // console.debug = () => {};

                try {
                    // Call the actual MCP tool with timeout monitoring
                    const response = await Promise.race([
                        mcpMapping.client.callTool({
                            name: mcpMapping.originalToolName,
                            arguments: mcpArgs,
                        }),
                        new Promise((_, reject) =>
                            setTimeout(
                                () =>
                                    reject(
                                        new Error("Custom timeout after 30s")
                                    ),
                                30000
                            )
                        ),
                    ]);

                    const endTime = Date.now();

                    // Restore console before logging success
                    console.error = originalConsoleError;
                    console.warn = originalConsoleWarn;
                    console.log = originalConsoleLog;
                    console.info = originalConsoleInfo;
                    console.debug = originalConsoleDebug;

                    console.log(
                        `MCP Tool Mapper: ${serverName} call completed in ${
                            endTime - startTime
                        }ms`
                    );

                    // Process and return the response
                    if (response) {
                        if (response.isError) {
                            // Clean error message without exposing internal details
                            const errorMsg = `MCP Tool Error: ${response.content}`;
                            console.log(`MCP Tool Mapper: ${errorMsg}`);
                            throw new Error(errorMsg);
                        }
                        return this.formatMcpResponse(response);
                    } else {
                        throw new Error("No response received from MCP tool");
                    }
                } finally {
                    // Always restore console methods even if error occurs
                    console.error = originalConsoleError;
                    console.warn = originalConsoleWarn;
                    console.log = originalConsoleLog;
                    console.info = originalConsoleInfo;
                    console.debug = originalConsoleDebug;
                }
            } catch (error) {
                // ULTRAFIX: Complete silence - no error details in console
                console.log(`MCP Tool Mapper: ${handlerName} call failed`);

                // Extract only essential error info for Gemini
                let cleanMessage = "Tool execution failed";
                if (
                    error.message &&
                    error.message.includes("validation_error")
                ) {
                    cleanMessage = "Invalid arguments provided";
                } else if (error.message && error.message.includes("404")) {
                    cleanMessage = "Resource not found";
                } else if (error.message && error.message.includes("400")) {
                    cleanMessage = "Bad request";
                }

                throw new Error(cleanMessage);
            }
        };
    }

    /**
     * Convert MCP tool schema to Gemini-compliant schema
     * @param {Object} tool - MCP tool definition
     * @returns {Object} - Gemini-compliant schema
     */
    convertToGeminiSchema(tool) {
        const schema = tool.inputSchema || {};

        // Start with a basic object schema with proper Gemini types
        const geminiSchema = {
            type: "OBJECT",
            properties: {},
        };

        // Copy description if available
        if (tool.description) {
            geminiSchema.description = tool.description;
        }

        // Process properties using enhanced method that preserves metadata
        if (schema.properties) {
            geminiSchema.properties = {};
            const mcpMetadata = { propertiesMetadata: {} };

            for (const [key, prop] of Object.entries(schema.properties)) {
                const processed = this.processSchemaPropertyWithMetadata(
                    prop,
                    key
                );
                geminiSchema.properties[key] = processed.geminiSchema;
                mcpMetadata.propertiesMetadata[key] = processed.mcpMetadata;
            }

            // Store the metadata for later use in MCP calls
            this.mcpMetadataStore = this.mcpMetadataStore || new Map();
            this.mcpMetadataStore.set(tool.name, mcpMetadata);
        }

        // Copy required fields
        if (schema.required && Array.isArray(schema.required)) {
            geminiSchema.required = [...schema.required];
        }

        // Validate the final schema meets Gemini requirements
        return this.validateGeminiSchema(geminiSchema);
    }

    /**
     * Validate that a schema meets Gemini API requirements
     * @param {Object} schema - Schema to validate
     * @returns {Object} - Validated schema
     */
    validateGeminiSchema(schema) {
        const validated = { ...schema };

        // Ensure type is uppercase
        if (validated.type && typeof validated.type === "string") {
            validated.type = this.convertToGeminiType(
                validated.type.toLowerCase()
            );
        }

        // Validate properties recursively
        if (validated.properties) {
            for (const [key, prop] of Object.entries(validated.properties)) {
                validated.properties[key] =
                    this.validateGeminiSchemaProperty(prop);
            }
        }

        // Validate items for arrays
        if (validated.type === "ARRAY" && validated.items) {
            validated.items = this.validateGeminiSchemaProperty(
                validated.items
            );
        }

        return validated;
    }

    /**
     * Validate a single schema property for Gemini compatibility
     * @param {Object} prop - Property to validate
     * @returns {Object} - Validated property
     */
    validateGeminiSchemaProperty(prop) {
        const validated = { ...prop };

        // Ensure type is uppercase
        if (validated.type && typeof validated.type === "string") {
            validated.type = this.convertToGeminiType(
                validated.type.toLowerCase()
            );
        }

        // Validate nested properties
        if (validated.properties) {
            for (const [key, nestedProp] of Object.entries(
                validated.properties
            )) {
                validated.properties[key] =
                    this.validateGeminiSchemaProperty(nestedProp);
            }
        }

        // Validate array items
        if (validated.type === "ARRAY" && validated.items) {
            validated.items = this.validateGeminiSchemaProperty(
                validated.items
            );
        }

        // Ensure enum values are strings and types are compatible
        if (validated.enum && Array.isArray(validated.enum)) {
            // Gemini only supports enums for STRING types
            if (validated.type !== "STRING") {
                console.log(
                    `MCP Tool Mapper: Converting ${validated.type} to STRING in validation due to enum constraint`
                );
                validated.type = "STRING";
            }
            validated.enum = validated.enum.map((val) => String(val));
        }

        return validated;
    }

    /**
     * Process schema properties to ensure Gemini compatibility
     * @param {Object} properties - Schema properties
     * @returns {Object} - Processed properties
     */
    processSchemaProperties(properties) {
        const processed = {};

        for (const [key, prop] of Object.entries(properties)) {
            if (!prop || typeof prop !== "object") {
                processed[key] = { type: "STRING" };
                continue;
            }

            processed[key] = this.processSchemaProperty(prop);
        }

        return processed;
    }

    /**
     * Process a single schema property with full JSON Schema support
     * @param {Object} prop - Property schema
     * @returns {Object} - Processed property
     */
    processSchemaProperty(prop) {
        const processed = {};

        // Handle oneOf/anyOf - take the first option or create a flexible type
        if (prop.oneOf || prop.anyOf) {
            const options = prop.oneOf || prop.anyOf;
            if (options.length > 0) {
                // Use the first option as the base, but make it more flexible
                const firstOption = options[0];
                Object.assign(
                    processed,
                    this.processSchemaProperty(firstOption)
                );

                // Add description about multiple types if available
                if (prop.description) {
                    processed.description = prop.description;
                } else {
                    const types = options
                        .map(
                            (opt) =>
                                this.convertToGeminiType(opt.type) || "OBJECT"
                        )
                        .join("/");
                    processed.description = `Supports multiple types: ${types}`;
                }
            } else {
                processed.type = "STRING"; // fallback
            }
        } else {
            processed.type = this.convertToGeminiType(prop.type) || "STRING";
        }

        // Copy description
        if (prop.description) {
            processed.description = prop.description;
        }

        // Handle enums - Gemini only supports enums for STRING types
        if (prop.enum && Array.isArray(prop.enum)) {
            // If we have an enum, we need to ensure the type is STRING for Gemini compatibility
            if (processed.type !== "STRING") {
                console.log(
                    `MCP Tool Mapper: Converting ${processed.type} to STRING due to enum constraint`
                );
                processed.type = "STRING";
            }
            processed.enum = prop.enum.map((val) => String(val));
        }

        // Handle arrays with full support for complex items
        if (processed.type === "ARRAY" && prop.items) {
            processed.items = this.processSchemaProperty(prop.items);
        }

        // Handle objects with nested properties
        if (processed.type === "OBJECT") {
            if (prop.properties) {
                processed.properties = this.processSchemaProperties(
                    prop.properties
                );
                if (prop.required) {
                    processed.required = prop.required;
                }
            }

            // Handle additionalProperties - enhanced for Notion MCP compatibility
            if (prop.additionalProperties !== undefined) {
                if (typeof prop.additionalProperties === "object") {
                    // For Gemini compatibility, we'll include it but it might be ignored
                    processed.additionalProperties = this.processSchemaProperty(
                        prop.additionalProperties
                    );
                } else if (prop.additionalProperties === true) {
                    // When additionalProperties is true, we need to be more flexible
                    // For parent objects in Notion, this means database_id, page_id, etc. are all valid
                    processed.additionalProperties = true;

                    // Add common known properties for Notion parent objects
                    if (!processed.properties) {
                        processed.properties = {};
                    }

                    // If this looks like a Notion parent object, add database_id support
                    if (processed.properties.page_id) {
                        console.log(
                            "MCP Tool Mapper: Adding database_id support to parent object with additionalProperties: true"
                        );
                        processed.properties.database_id = {
                            type: "STRING",
                            description:
                                "Database ID for adding entries to databases. Use notionPostSearch with filter={'value':'database','property':'object'} to find database IDs. REQUIRED when adding to databases.",
                        };
                        processed.properties.type = {
                            type: "STRING",
                            enum: ["page_id", "database_id"],
                            description:
                                "CRITICAL: Use 'database_id' when adding entries to databases (found via search with filter={'value':'database'}), 'page_id' when adding pages inside other pages (found via search with filter={'value':'page'}). Must match the ID type being used.",
                        };
                        processed.properties.workspace = {
                            type: "BOOLEAN",
                            description:
                                "Set to true for workspace parent (rarely used)",
                        };

                        // Make page_id optional since we now have alternatives
                        if (
                            processed.required &&
                            processed.required.includes("page_id")
                        ) {
                            processed.required = processed.required.filter(
                                (req) => req !== "page_id"
                            );
                        }

                        // Add guidance in the description
                        if (processed.description) {
                            processed.description +=
                                " CRITICAL: When adding to a database (found via search with filter={'value':'database'}), use database_id and type='database_id'. When adding to a page (found via search with filter={'value':'page'}), use page_id and type='page_id'.";
                        }

                        // Update the description to be more helpful
                        if (processed.properties.page_id) {
                            processed.properties.page_id.description =
                                "Page ID for adding sub-pages to existing pages. Use notionPostSearch with filter={'value':'page','property':'object'} to find page IDs.";
                        }
                    }
                }
            }
        }

        // Handle number constraints
        if (processed.type === "NUMBER" || processed.type === "INTEGER") {
            if (prop.minimum !== undefined) processed.minimum = prop.minimum;
            if (prop.maximum !== undefined) processed.maximum = prop.maximum;
            if (prop.default !== undefined) processed.default = prop.default;
        }

        // Handle string patterns and formats
        if (processed.type === "STRING") {
            if (prop.pattern) processed.pattern = prop.pattern;

            // Gemini API only supports format: "enum" for STRING properties with enum values
            // Aggressively filter out problematic formats that break Gemini API
            const problematicFormats = [
                "uuid",
                "date",
                "date-time",
                "email",
                "uri",
                "byte",
                "binary",
                "password",
            ];

            if (prop.format) {
                if (
                    prop.format === "enum" &&
                    prop.enum &&
                    prop.enum.length > 0
                ) {
                    processed.format = "enum";
                } else if (
                    problematicFormats.includes(prop.format.toLowerCase())
                ) {
                    console.log(
                        `MCP Tool Mapper: Removing problematic format '${prop.format}' that breaks Gemini API`
                    );
                    // Don't include the format property - this prevents Gemini API errors
                } else if (prop.enum && prop.enum.length > 0) {
                    console.log(
                        `MCP Tool Mapper: Converting format '${prop.format}' to 'enum' for property with enum values`
                    );
                    processed.format = "enum";
                } else {
                    console.log(
                        `MCP Tool Mapper: Removing unsupported format '${prop.format}' (only 'enum' format supported for STRING)`
                    );
                    // Don't include the format property
                }
            }

            if (prop.default !== undefined) processed.default = prop.default;

            // Handle string length constraints
            if (prop.minLength !== undefined)
                processed.minLength = String(prop.minLength);
            if (prop.maxLength !== undefined)
                processed.maxLength = String(prop.maxLength);
        }

        // Handle array constraints
        if (processed.type === "ARRAY") {
            if (prop.minItems !== undefined)
                processed.minItems = String(prop.minItems);
            if (prop.maxItems !== undefined)
                processed.maxItems = String(prop.maxItems);
        }

        // Handle object constraints
        if (processed.type === "OBJECT") {
            if (prop.minProperties !== undefined)
                processed.minProperties = String(prop.minProperties);
            if (prop.maxProperties !== undefined)
                processed.maxProperties = String(prop.maxProperties);
        }

        // Handle default values
        if (prop.default !== undefined && !processed.default) {
            processed.default = prop.default;
        }

        // Handle nullable
        if (prop.nullable !== undefined) {
            processed.nullable = prop.nullable;
        }

        // Final cleanup: Remove any properties that Gemini API doesn't support
        const unsupportedProps = [
            "contentEncoding",
            "contentMediaType",
            "examples",
            "$ref",
            "$schema",
            "$id",
            "additionalProperties",
            "patternProperties",
            "dependencies",
            "allOf",
            "oneOf", // We handle oneOf/anyOf separately above
            "anyOf",
            "not",
        ];
        for (const unsupportedProp of unsupportedProps) {
            if (processed[unsupportedProp] !== undefined) {
                console.log(
                    `MCP Tool Mapper: Removing unsupported property '${unsupportedProp}' from schema`
                );
                delete processed[unsupportedProp];
            }
        }

        return processed;
    }

    /**
     * Enhanced schema processing that preserves original properties for MCP calls
     * @param {Object} prop - Property schema
     * @param {string} path - Property path for debugging
     * @returns {Object} - {geminiSchema, mcpMetadata}
     */
    processSchemaPropertyWithMetadata(prop, path = "") {
        const geminiSchema = {};
        const mcpMetadata = {
            originalFormat: prop.format,
            defaultValue: prop.default,
            constraints: {},
            removedProperties: [],
        };

        // Handle oneOf/anyOf - take the first option or create a flexible type
        if (prop.oneOf || prop.anyOf) {
            const options = prop.oneOf || prop.anyOf;
            if (options.length > 0) {
                const firstOption = options[0];
                const processed = this.processSchemaPropertyWithMetadata(
                    firstOption,
                    `${path}.oneOf[0]`
                );
                Object.assign(geminiSchema, processed.geminiSchema);
                Object.assign(mcpMetadata, processed.mcpMetadata);

                if (prop.description) {
                    geminiSchema.description = prop.description;
                } else {
                    const types = options
                        .map(
                            (opt) =>
                                this.convertToGeminiType(opt.type) || "OBJECT"
                        )
                        .join("/");
                    geminiSchema.description = `Supports multiple types: ${types}`;
                }
            } else {
                geminiSchema.type = "STRING";
            }
        } else {
            geminiSchema.type = this.convertToGeminiType(prop.type) || "STRING";
        }

        // Copy description
        if (prop.description) {
            geminiSchema.description = prop.description;
        }

        // Handle enums - Gemini only supports enums for STRING types
        if (prop.enum && Array.isArray(prop.enum)) {
            if (geminiSchema.type !== "STRING") {
                console.log(
                    `MCP Tool Mapper: Converting ${geminiSchema.type} to STRING due to enum constraint at ${path}`
                );
                geminiSchema.type = "STRING";
            }
            geminiSchema.enum = prop.enum.map((val) => String(val));
            if (prop.format === "enum") {
                geminiSchema.format = "enum";
            }
        }

        // Handle arrays
        if (geminiSchema.type === "ARRAY" && prop.items) {
            const itemsProcessed = this.processSchemaPropertyWithMetadata(
                prop.items,
                `${path}.items`
            );
            geminiSchema.items = itemsProcessed.geminiSchema;
            mcpMetadata.itemsMetadata = itemsProcessed.mcpMetadata;
        }

        // Handle objects
        if (geminiSchema.type === "OBJECT") {
            if (prop.properties) {
                geminiSchema.properties = {};
                mcpMetadata.propertiesMetadata = {};

                for (const [key, nestedProp] of Object.entries(
                    prop.properties
                )) {
                    const processed = this.processSchemaPropertyWithMetadata(
                        nestedProp,
                        `${path}.${key}`
                    );
                    geminiSchema.properties[key] = processed.geminiSchema;
                    mcpMetadata.propertiesMetadata[key] = processed.mcpMetadata;
                }

                if (prop.required) {
                    geminiSchema.required = prop.required;
                }
            }

            // Handle additionalProperties but remove it from Gemini schema
            if (prop.additionalProperties !== undefined) {
                mcpMetadata.additionalProperties = prop.additionalProperties;
                mcpMetadata.removedProperties.push("additionalProperties");
                console.log(
                    `MCP Tool Mapper: Removing unsupported property 'additionalProperties' from schema at ${path}`
                );
            }
        }

        // Store and remove format constraints for Gemini compatibility
        if (prop.format && geminiSchema.format !== "enum") {
            mcpMetadata.originalFormat = prop.format;
            mcpMetadata.removedProperties.push("format");
            console.log(
                `MCP Tool Mapper: Removing problematic format '${prop.format}' that breaks Gemini API at ${path}`
            );
        }

        // Store and remove default values
        if (prop.default !== undefined) {
            mcpMetadata.defaultValue = prop.default;
            mcpMetadata.removedProperties.push("default");
            console.log(
                `MCP Tool Mapper: Removing unsupported property 'default' from schema at ${path}`
            );
        }

        // Store and remove constraints
        const constraintProps = [
            "minimum",
            "maximum",
            "minLength",
            "maxLength",
            "minItems",
            "maxItems",
            "minProperties",
            "maxProperties",
            "pattern",
        ];
        constraintProps.forEach((constraintProp) => {
            if (prop[constraintProp] !== undefined) {
                mcpMetadata.constraints[constraintProp] = prop[constraintProp];
                mcpMetadata.removedProperties.push(constraintProp);
                console.log(
                    `MCP Tool Mapper: Removing unsupported property '${constraintProp}' from schema at ${path}`
                );
            }
        });

        return { geminiSchema, mcpMetadata };
    }

    /**
     * Apply default values to MCP arguments based on stored metadata
     * @param {Object} args - Arguments from Gemini
     * @param {Object} mcpMetadata - Stored MCP metadata with defaults
     * @param {string} path - Current path for nested processing
     * @returns {Object} - Arguments with defaults applied
     */
    applyMcpDefaults(args, mcpMetadata, path = "") {
        if (!args || typeof args !== "object") return args;

        // CRITICAL FIX: Preserve arrays explicitly
        if (Array.isArray(args)) {
            console.log(
                `MCP Tool Mapper: Processing array at ${path}, length: ${args.length}`
            );
            const result = [...args]; // Create a copy to preserve array structure

            // Process array items if metadata exists
            if (mcpMetadata && mcpMetadata.itemsMetadata) {
                result.forEach((item, index) => {
                    result[index] = this.applyMcpDefaults(
                        item,
                        mcpMetadata.itemsMetadata,
                        `${path}[${index}]`
                    );
                });
            }

            console.log(
                `MCP Tool Mapper: Array processing complete at ${path}, result length: ${result.length}`
            );
            return result;
        }

        const result = { ...args };

        // Apply default value if argument is missing
        if (
            mcpMetadata &&
            mcpMetadata.defaultValue !== undefined &&
            result === undefined
        ) {
            console.log(`MCP Tool Mapper: Applying default value at ${path}`);
            return mcpMetadata.defaultValue;
        }

        // Process nested properties
        if (
            mcpMetadata &&
            mcpMetadata.propertiesMetadata &&
            typeof result === "object"
        ) {
            for (const [key, propertyMetadata] of Object.entries(
                mcpMetadata.propertiesMetadata
            )) {
                if (
                    propertyMetadata.defaultValue !== undefined &&
                    result[key] === undefined
                ) {
                    console.log(
                        `MCP Tool Mapper: Applying default value for ${path}.${key}`
                    );
                    result[key] = propertyMetadata.defaultValue;
                } else if (result[key] !== undefined) {
                    result[key] = this.applyMcpDefaults(
                        result[key],
                        propertyMetadata,
                        `${path}.${key}`
                    );
                }
            }
        }

        return result;
    }

    /**
     * Convert JSON Schema type to Gemini API Type enum
     * @param {string} jsonSchemaType - JSON Schema type
     * @returns {string} - Gemini API Type enum value
     */
    convertToGeminiType(jsonSchemaType) {
        const typeMapping = {
            string: "STRING",
            number: "NUMBER",
            integer: "INTEGER",
            boolean: "BOOLEAN",
            array: "ARRAY",
            object: "OBJECT",
            null: "NULL",
        };

        return typeMapping[jsonSchemaType] || "STRING";
    }

    /**
     * Create a parameter mapping for transforming between formats
     * @param {Object} schema - Original MCP schema
     * @returns {Object} - Parameter mapping configuration
     */
    createParameterMapping(schema) {
        const mapping = {
            direct: [], // Properties that can be copied directly
            transforms: {}, // Properties that need transformation
            nested: {}, // Nested object mappings
            dynamicProperties: {}, // Objects with additionalProperties
            typeConversions: {}, // Track type conversions for reverse transformation
        };

        if (!schema || !schema.properties) {
            return mapping;
        }

        for (const [key, prop] of Object.entries(schema.properties)) {
            if (!prop || typeof prop !== "object") {
                mapping.direct.push(key);
                continue;
            }

            // Track if this property had enum and was converted from NUMBER/INTEGER to STRING
            if (
                prop.enum &&
                (prop.type === "number" || prop.type === "integer")
            ) {
                mapping.typeConversions[key] = {
                    originalType: prop.type,
                    convertedType: "string",
                    enumValues: prop.enum,
                };
                mapping.transforms[key] = "enumTypeConversion";
                continue;
            }

            // Handle oneOf/anyOf - treat as direct but with flexible handling
            if (prop.oneOf || prop.anyOf) {
                mapping.transforms[key] = "flexible";
                continue;
            }

            switch (prop.type) {
                case "array":
                    if (prop.items) {
                        if (
                            prop.items.type === "object" ||
                            prop.items.oneOf ||
                            prop.items.anyOf
                        ) {
                            mapping.transforms[key] = "objectArray";
                            // Store the array item schema for complex transformations
                            if (prop.items.oneOf || prop.items.anyOf) {
                                mapping.transforms[`${key}_itemSchema`] =
                                    "flexible";
                            } else if (prop.items.properties) {
                                mapping.transforms[`${key}_itemSchema`] =
                                    this.createParameterMapping(prop.items);
                            }
                        } else {
                            mapping.direct.push(key);
                        }
                    } else {
                        mapping.direct.push(key);
                    }
                    break;

                case "object":
                    if (prop.additionalProperties) {
                        mapping.dynamicProperties[key] = {
                            additionalProperties: prop.additionalProperties,
                            baseProperties: prop.properties
                                ? this.createParameterMapping(prop)
                                : null,
                        };
                    } else if (prop.properties) {
                        mapping.nested[key] = this.createParameterMapping(prop);
                    } else {
                        mapping.direct.push(key);
                    }
                    break;

                default:
                    mapping.direct.push(key);
            }
        }

        return mapping;
    }

    /**
     * Transform Gemini arguments to MCP format with defaults applied
     * @param {Object} geminiArgs - Arguments from Gemini
     * @param {Object} mapping - Parameter mapping configuration
     * @param {Object} mcpMetadata - Stored MCP metadata with defaults and constraints
     * @returns {Object} - MCP-formatted arguments with defaults
     */
    transformArgsToMcp(geminiArgs, mapping, mcpMetadata = null) {
        console.log(
            `MCP Tool Mapper: TRANSFORM START - Input args:`,
            JSON.stringify(geminiArgs, null, 2)
        );
        const mcpArgs = {};

        // Copy direct properties (excluding null/undefined values)
        for (const key of mapping.direct) {
            if (geminiArgs.hasOwnProperty(key) && geminiArgs[key] != null) {
                console.log(
                    `MCP Tool Mapper: Processing direct property '${key}', type: ${typeof geminiArgs[
                        key
                    ]}, isArray: ${Array.isArray(geminiArgs[key])}`
                );

                // CRITICAL FIX: Special handling for children blocks
                if (key === "children" && Array.isArray(geminiArgs[key])) {
                    console.log(
                        `MCP Tool Mapper: Validating children blocks for Notion API`
                    );
                    const validatedChildren = this.validateBlocksArray(
                        geminiArgs[key]
                    );
                    console.log(
                        `MCP Tool Mapper: After children validation:`,
                        JSON.stringify(validatedChildren, null, 2)
                    );
                    mcpArgs[key] = validatedChildren;
                } else {
                    // CRITICAL FIX: Deep copy preserving all arrays and structures
                    const copied = this.deepCopyPreservingArrays(
                        geminiArgs[key]
                    );
                    console.log(
                        `MCP Tool Mapper: After deep copy for '${key}':`,
                        JSON.stringify(copied, null, 2)
                    );
                    mcpArgs[key] = copied;
                }
            }
        }

        // Handle transformations
        for (const [key, transform] of Object.entries(mapping.transforms)) {
            if (key.endsWith("_itemSchema")) {
                continue; // Skip item schema definitions
            }

            if (geminiArgs.hasOwnProperty(key) && geminiArgs[key] != null) {
                switch (transform) {
                    case "objectArray":
                        // Handle arrays of objects with potential complex nested structures
                        mcpArgs[key] = this.transformObjectArray(
                            geminiArgs[key],
                            mapping.transforms[`${key}_itemSchema`]
                        );
                        break;

                    case "flexible":
                        // Handle oneOf/anyOf - pass through as-is since structure is flexible
                        // CRITICAL FIX: Deep copy preserving arrays
                        mcpArgs[key] = this.deepCopyPreservingArrays(
                            geminiArgs[key]
                        );
                        break;

                    case "enumTypeConversion":
                        // Convert string enum values back to original numeric type
                        mcpArgs[key] = this.convertEnumValue(
                            geminiArgs[key],
                            mapping.typeConversions[key]
                        );
                        break;

                    default:
                        // CRITICAL FIX: Deep copy preserving arrays for any transformation type
                        mcpArgs[key] = this.deepCopyPreservingArrays(
                            geminiArgs[key]
                        );
                }
            }
        }

        // Handle nested objects (with special handling for parent objects)
        for (const [key, nestedMapping] of Object.entries(mapping.nested)) {
            if (geminiArgs.hasOwnProperty(key) && geminiArgs[key]) {
                if (key === "parent") {
                    // Special handling for Notion parent objects
                    mcpArgs[key] = this.transformNotionParent(geminiArgs[key]);
                } else {
                    const nestedMetadata =
                        mcpMetadata?.propertiesMetadata?.[key] || null;
                    mcpArgs[key] = this.transformArgsToMcp(
                        geminiArgs[key],
                        nestedMapping,
                        nestedMetadata
                    );
                }
            }
        }

        // Handle dynamic properties (additionalProperties)
        for (const [key, dynamicConfig] of Object.entries(
            mapping.dynamicProperties
        )) {
            if (geminiArgs.hasOwnProperty(key) && geminiArgs[key]) {
                console.log(
                    `MCP Tool Mapper: Processing dynamic property '${key}', type: ${typeof geminiArgs[
                        key
                    ]}, isArray: ${Array.isArray(geminiArgs[key])}`
                );
                console.log(
                    `MCP Tool Mapper: Dynamic property '${key}' value:`,
                    JSON.stringify(geminiArgs[key], null, 2)
                );

                if (key === "parent") {
                    // Special handling for Notion parent objects
                    const result = this.transformNotionParent(geminiArgs[key]);
                    console.log(
                        `MCP Tool Mapper: After transformNotionParent:`,
                        JSON.stringify(result, null, 2)
                    );
                    mcpArgs[key] = result;
                } else {
                    // CRITICAL FIX: For properties objects, preserve structure correctly
                    if (
                        key === "properties" &&
                        typeof geminiArgs[key] === "object"
                    ) {
                        console.log(
                            `MCP Tool Mapper: Special handling for properties object`
                        );
                        const result = this.transformPropertiesObject(
                            geminiArgs[key],
                            dynamicConfig
                        );
                        console.log(
                            `MCP Tool Mapper: After transformPropertiesObject:`,
                            JSON.stringify(result, null, 2)
                        );
                        mcpArgs[key] = result;
                    } else {
                        console.log(
                            `MCP Tool Mapper: General dynamic property handling for '${key}'`
                        );
                        const result = this.transformDynamicProperties(
                            geminiArgs[key],
                            dynamicConfig
                        );
                        console.log(
                            `MCP Tool Mapper: After transformDynamicProperties:`,
                            JSON.stringify(result, null, 2)
                        );
                        mcpArgs[key] = result;
                    }
                }
            }
        }

        // Apply default values from stored MCP metadata
        if (mcpMetadata) {
            const argsWithDefaults = this.applyMcpDefaults(
                mcpArgs,
                mcpMetadata
            );
            console.log(
                `MCP Tool Mapper: TRANSFORM END - Final result with defaults:`,
                JSON.stringify(argsWithDefaults, null, 2)
            );
            return argsWithDefaults;
        }

        console.log(
            `MCP Tool Mapper: TRANSFORM END - Final result without defaults:`,
            JSON.stringify(mcpArgs, null, 2)
        );
        return mcpArgs;
    }

    /**
     * Transform Notion parent object, filtering out null values and ensuring proper format
     * @param {Object} parentObj - Parent object from Gemini
     * @returns {Object} - Cleaned parent object for Notion API
     */
    transformNotionParent(parentObj) {
        if (!parentObj || typeof parentObj !== "object") {
            return parentObj;
        }

        const cleaned = {};

        // Only include non-null properties
        for (const [key, value] of Object.entries(parentObj)) {
            if (value != null) {
                cleaned[key] = value;
            }
        }

        // CRITICAL FIX: Handle database vs page parent types according to Notion API requirements
        const validParentKeys = ["page_id", "database_id", "workspace"];
        const presentKeys = Object.keys(cleaned).filter((key) =>
            validParentKeys.includes(key)
        );

        if (presentKeys.length === 0) {
            console.warn("MCP Tool Mapper: No valid parent type found");
            return cleaned;
        } else if (presentKeys.length > 1) {
            console.warn(
                `MCP Tool Mapper: Multiple parent types found: ${presentKeys.join(
                    ", "
                )}, using first one`
            );
            // Keep only the first valid parent type
            const keepKey = presentKeys[0];
            const result = {};
            result[keepKey] = cleaned[keepKey];

            console.log(
                `MCP Tool Mapper: Cleaned parent object (single type):`,
                result
            );
            return result;
        }

        // Single parent type found - just return the relevant field
        const result = {};

        // CRITICAL FIX: Do NOT include 'type' field in the actual API call
        // The 'type' field is only for Gemini's understanding, not for Notion API
        if (cleaned.page_id) {
            result.page_id = cleaned.page_id;
            console.log(`MCP Tool Mapper: Page parent object:`, result);
        } else if (cleaned.database_id) {
            result.database_id = cleaned.database_id;
            console.log(`MCP Tool Mapper: Database parent object:`, result);
        } else if (cleaned.workspace) {
            result.workspace = cleaned.workspace;
            console.log(`MCP Tool Mapper: Workspace parent object:`, result);
        } else {
            // Fallback - return the cleaned object without the problematic 'type' field
            const { type, ...resultWithoutType } = cleaned;
            console.log(
                `MCP Tool Mapper: Fallback parent object (type removed):`,
                resultWithoutType
            );
            return resultWithoutType;
        }

        return result;
    }

    /**
     * Transform an array of objects with potential complex nested structures
     * @param {Array} arrayValue - Array to transform
     * @param {Object|string} itemMapping - Mapping for array items
     * @returns {Array} - Transformed array
     */
    transformObjectArray(arrayValue, itemMapping) {
        if (!Array.isArray(arrayValue)) {
            return Array.isArray(arrayValue) ? arrayValue : [arrayValue];
        }

        if (!itemMapping) {
            return arrayValue; // No special transformation needed
        }

        return arrayValue.map((item) => {
            if (typeof item === "object" && item !== null) {
                if (itemMapping === "flexible") {
                    // For flexible items (oneOf/anyOf), pass through as-is
                    return item;
                } else if (typeof itemMapping === "object") {
                    // Apply the item mapping
                    return this.transformArgsToMcp(item, itemMapping);
                } else {
                    return item;
                }
            }
            return item;
        });
    }

    /**
     * Transform objects with additionalProperties
     * @param {Object} objValue - Object to transform
     * @param {Object} dynamicConfig - Dynamic properties configuration
     * @returns {Object} - Transformed object
     */
    transformDynamicProperties(objValue, dynamicConfig) {
        if (!objValue || typeof objValue !== "object") {
            return objValue;
        }

        const transformed = {};

        // Handle base properties if they exist
        if (dynamicConfig.baseProperties) {
            Object.assign(
                transformed,
                this.transformArgsToMcp(objValue, dynamicConfig.baseProperties)
            );
        }

        // Handle dynamic properties
        for (const [propKey, propValue] of Object.entries(objValue)) {
            if (!transformed.hasOwnProperty(propKey)) {
                // This is a dynamic property
                if (
                    dynamicConfig.additionalProperties &&
                    typeof dynamicConfig.additionalProperties === "object"
                ) {
                    // Transform according to additionalProperties schema
                    if (Array.isArray(propValue)) {
                        // CRITICAL FIX: Preserve arrays in dynamic properties
                        transformed[propKey] = [...propValue];
                    } else if (
                        typeof propValue === "object" &&
                        propValue !== null
                    ) {
                        transformed[propKey] = this.transformObjectValue(
                            propValue,
                            dynamicConfig.additionalProperties
                        );
                    } else {
                        transformed[propKey] = propValue;
                    }
                } else {
                    // CRITICAL FIX: Preserve arrays when no additionalProperties schema
                    if (Array.isArray(propValue)) {
                        transformed[propKey] = [...propValue];
                    } else {
                        transformed[propKey] = propValue;
                    }
                }
            }
        }

        return transformed;
    }

    /**
     * Transform a single object value according to a schema
     * @param {Object} value - Object to transform
     * @param {Object} schema - Schema to apply
     * @returns {Object} - Transformed object
     */
    transformObjectValue(value, schema) {
        if (!schema.properties) {
            return value; // No transformation needed
        }

        const mapping = this.createParameterMapping(schema);
        return this.transformArgsToMcp(value, mapping);
    }

    /**
     * Format MCP response for return to Gemini
     * @param {Object} mcpResponse - Response from MCP tool
     * @returns {string} - Formatted response
     */
    formatMcpResponse(mcpResponse) {
        if (mcpResponse.content && Array.isArray(mcpResponse.content)) {
            // Extract text content from MCP response
            const textContent = mcpResponse.content
                .filter((item) => item.type === "text")
                .map((item) => item.text)
                .join("\n");

            return textContent || JSON.stringify(mcpResponse.content, null, 2);
        }

        return typeof mcpResponse === "string"
            ? mcpResponse
            : JSON.stringify(mcpResponse, null, 2);
    }

    /**
     * Get all handler functions for Gemini
     * @returns {Array} - Array of handler function declarations
     */
    getHandlerDeclarations() {
        return Array.from(this.handlerFunctions.values()).map((handler) => {
            const declaration = {
                name: handler.name,
                description: handler.description || `MCP tool: ${handler.name}`,
                parameters: handler.parameters,
            };

            // Validate that the declaration meets Gemini requirements
            return this.validateFunctionDeclaration(declaration);
        });
    }

    /**
     * Validate a function declaration for Gemini API compliance
     * @param {Object} declaration - Function declaration to validate
     * @returns {Object} - Validated declaration
     */
    validateFunctionDeclaration(declaration) {
        const validated = {};

        // Name is required and must meet specific requirements
        if (!declaration.name || typeof declaration.name !== "string") {
            throw new Error("Function declaration must have a valid name");
        }

        // Validate name format: Must start with letter/underscore, contain only a-z, A-Z, 0-9, underscores, dots, dashes, max 64 chars
        const nameRegex = /^[a-zA-Z_][a-zA-Z0-9_.-]{0,63}$/;
        if (!nameRegex.test(declaration.name)) {
            throw new Error(
                `Function name "${declaration.name}" does not meet Gemini API requirements. Must start with letter/underscore and contain only a-z, A-Z, 0-9, underscores, dots, dashes (max 64 chars)`
            );
        }

        validated.name = declaration.name;

        // Description is optional but recommended
        validated.description =
            declaration.description || `Function: ${declaration.name}`;

        // Parameters must be a valid Schema object
        if (declaration.parameters) {
            validated.parameters = this.validateGeminiSchema(
                declaration.parameters
            );
        } else {
            // Provide empty object schema if no parameters
            validated.parameters = {
                type: "OBJECT",
                properties: {},
            };
        }

        return validated;
    }

    /**
     * Execute a handler function by name
     * @param {string} handlerName - Name of the handler function
     * @param {Object} args - Arguments from Gemini
     * @returns {Promise<string>} - Result from MCP tool
     */
    async executeHandler(handlerName, args) {
        const handler = this.handlerFunctions.get(handlerName);
        if (!handler) {
            throw new Error(`Handler function ${handlerName} not found`);
        }

        return await handler.handler(args);
    }

    /**
     * Check if a function name is a registered handler
     * @param {string} functionName - Function name to check
     * @returns {boolean} - True if it's a registered handler
     */
    isHandler(functionName) {
        return this.handlerFunctions.has(functionName);
    }

    /**
     * Get debug information about registered tools
     * @returns {Object} - Debug information
     */
    getDebugInfo() {
        return {
            totalHandlers: this.handlerFunctions.size,
            servers: Array.from(this.clientMap.keys()),
            handlers: Array.from(this.handlerFunctions.keys()),
            mappings: Array.from(this.handlerToMcpMap.entries()).map(
                ([handler, mapping]) => ({
                    handler,
                    server: mapping.serverName,
                    originalTool: mapping.originalToolName,
                })
            ),
        };
    }

    /**
     * Convert enum value back to original type
     * @param {string} value - String value from Gemini
     * @param {Object} typeConversion - Type conversion configuration
     * @returns {number|string} - Converted value
     */
    convertEnumValue(value, typeConversion) {
        if (!typeConversion || !typeConversion.originalType) {
            return value;
        }

        switch (typeConversion.originalType) {
            case "number":
                const numValue = Number(value);
                if (!isNaN(numValue)) {
                    console.log(
                        `MCP Tool Mapper: Converting enum value "${value}" (string) → ${numValue} (number)`
                    );
                    return numValue;
                }
                break;
            case "integer":
                const intValue = parseInt(value, 10);
                if (!isNaN(intValue)) {
                    console.log(
                        `MCP Tool Mapper: Converting enum value "${value}" (string) → ${intValue} (integer)`
                    );
                    return intValue;
                }
                break;
        }

        console.warn(
            `MCP Tool Mapper: Failed to convert enum value "${value}" to ${typeConversion.originalType}`
        );
        return value;
    }

    /**
     * Transform Notion properties object, preserving arrays and structure
     * @param {Object} propertiesObj - Properties object from Gemini
     * @param {Object} dynamicConfig - Dynamic configuration
     * @returns {Object} - Transformed properties object
     */
    transformPropertiesObject(propertiesObj, dynamicConfig) {
        console.log(
            `MCP Tool Mapper: transformPropertiesObject INPUT:`,
            JSON.stringify(propertiesObj, null, 2)
        );

        if (!propertiesObj || typeof propertiesObj !== "object") {
            console.log(`MCP Tool Mapper: Invalid input - returning as is`);
            return propertiesObj;
        }

        const transformed = {};

        // Process each property, preserving arrays and fixing Notion API structure
        for (const [propKey, propValue] of Object.entries(propertiesObj)) {
            console.log(
                `MCP Tool Mapper: Processing property '${propKey}', type: ${typeof propValue}, isArray: ${Array.isArray(
                    propValue
                )}`
            );
            console.log(
                `MCP Tool Mapper: Property '${propKey}' value:`,
                JSON.stringify(propValue, null, 2)
            );

            if (propValue != null) {
                // CRITICAL FIX: Handle Notion API property structure transformation
                if (
                    (propKey === "title" || propKey === "Title") &&
                    Array.isArray(propValue)
                ) {
                    // For database entries, title property should be a direct array of rich text objects
                    // Notion API expects: {"Title": [rich_text_objects]} for database entries
                    console.log(
                        `MCP Tool Mapper: Converting ${propKey} property for Notion database API structure`
                    );

                    // Validate and fix rich text structure
                    const validatedRichText =
                        this.validateRichTextArray(propValue);
                    transformed["Title"] = validatedRichText;
                    console.log(
                        `MCP Tool Mapper: Created Notion title property:`,
                        JSON.stringify(transformed["Title"], null, 2)
                    );
                } else if (
                    propKey === "rich_text" &&
                    Array.isArray(propValue)
                ) {
                    // Handle rich_text properties
                    console.log(
                        `MCP Tool Mapper: Converting rich_text property for Notion API structure`
                    );
                    transformed[propKey] = {
                        rich_text: this.deepCopyPreservingArrays(propValue),
                    };
                } else if (
                    propKey === "select" &&
                    typeof propValue === "object" &&
                    propValue.name
                ) {
                    // Handle select properties
                    console.log(
                        `MCP Tool Mapper: Converting select property for Notion API structure`
                    );
                    transformed[propKey] = {
                        select: this.deepCopyPreservingArrays(propValue),
                    };
                } else if (
                    propKey === "multi_select" &&
                    Array.isArray(propValue)
                ) {
                    // Handle multi_select properties
                    console.log(
                        `MCP Tool Mapper: Converting multi_select property for Notion API structure`
                    );
                    transformed[propKey] = {
                        multi_select: this.deepCopyPreservingArrays(propValue),
                    };
                } else if (
                    propKey === "date" &&
                    typeof propValue === "object"
                ) {
                    // Handle date properties
                    console.log(
                        `MCP Tool Mapper: Converting date property for Notion API structure`
                    );
                    transformed[propKey] = {
                        date: this.deepCopyPreservingArrays(propValue),
                    };
                } else if (
                    propKey === "number" &&
                    typeof propValue === "number"
                ) {
                    // Handle number properties
                    console.log(
                        `MCP Tool Mapper: Converting number property for Notion API structure`
                    );
                    transformed[propKey] = {
                        number: propValue,
                    };
                } else if (
                    propKey === "checkbox" &&
                    typeof propValue === "boolean"
                ) {
                    // Handle checkbox properties
                    console.log(
                        `MCP Tool Mapper: Converting checkbox property for Notion API structure`
                    );
                    transformed[propKey] = {
                        checkbox: propValue,
                    };
                } else if (propKey === "url" && typeof propValue === "string") {
                    // Handle URL properties
                    console.log(
                        `MCP Tool Mapper: Converting url property for Notion API structure`
                    );
                    transformed[propKey] = {
                        url: propValue,
                    };
                } else if (
                    propKey === "email" &&
                    typeof propValue === "string"
                ) {
                    // Handle email properties
                    console.log(
                        `MCP Tool Mapper: Converting email property for Notion API structure`
                    );
                    transformed[propKey] = {
                        email: propValue,
                    };
                } else if (
                    propKey === "phone_number" &&
                    typeof propValue === "string"
                ) {
                    // Handle phone number properties
                    console.log(
                        `MCP Tool Mapper: Converting phone_number property for Notion API structure`
                    );
                    transformed[propKey] = {
                        phone_number: propValue,
                    };
                } else if (propKey === "people" && Array.isArray(propValue)) {
                    // Handle people properties
                    console.log(
                        `MCP Tool Mapper: Converting people property for Notion API structure`
                    );
                    transformed[propKey] = {
                        people: this.deepCopyPreservingArrays(propValue),
                    };
                } else if (propKey === "files" && Array.isArray(propValue)) {
                    // Handle files properties
                    console.log(
                        `MCP Tool Mapper: Converting files property for Notion API structure`
                    );
                    transformed[propKey] = {
                        files: this.deepCopyPreservingArrays(propValue),
                    };
                } else if (propKey === "relation" && Array.isArray(propValue)) {
                    // Handle relation properties
                    console.log(
                        `MCP Tool Mapper: Converting relation property for Notion API structure`
                    );
                    transformed[propKey] = {
                        relation: this.deepCopyPreservingArrays(propValue),
                    };
                } else if (Array.isArray(propValue)) {
                    // CRITICAL FIX: Prevent array-to-object conversion for unknown array properties
                    console.log(
                        `MCP Tool Mapper: Preserving array for '${propKey}'`
                    );
                    transformed[propKey] =
                        this.deepCopyPreservingArrays(propValue);
                } else if (typeof propValue === "object") {
                    // For objects, recursively transform but preserve arrays within
                    console.log(
                        `MCP Tool Mapper: Deep copying object for '${propKey}'`
                    );
                    transformed[propKey] =
                        this.deepCopyPreservingArrays(propValue);
                } else {
                    // Primitive values
                    console.log(
                        `MCP Tool Mapper: Copying primitive for '${propKey}'`
                    );
                    transformed[propKey] = propValue;
                }
            }

            console.log(
                `MCP Tool Mapper: After processing '${propKey}':`,
                JSON.stringify(transformed[propKey] || "undefined", null, 2)
            );
        }

        console.log(
            `MCP Tool Mapper: transformPropertiesObject OUTPUT:`,
            JSON.stringify(transformed, null, 2)
        );
        return transformed;
    }

    /**
     * Deep copy an object while preserving array structures
     * @param {any} obj - Object to copy
     * @returns {any} - Deep copied object with preserved arrays
     */
    deepCopyPreservingArrays(obj) {
        if (obj === null || typeof obj !== "object") {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => this.deepCopyPreservingArrays(item));
        }

        const copy = {};
        for (const [key, value] of Object.entries(obj)) {
            copy[key] = this.deepCopyPreservingArrays(value);
        }

        return copy;
    }

    /**
     * Validate and fix rich text array structure for Notion API
     * @param {Array} richTextArray - Array of rich text objects
     * @returns {Array} - Validated rich text array
     */
    validateRichTextArray(richTextArray) {
        if (!Array.isArray(richTextArray)) {
            console.log(
                `MCP Tool Mapper: Converting non-array to rich text array`
            );
            return [
                {
                    type: "text",
                    text: {
                        content: String(richTextArray || ""),
                    },
                },
            ];
        }

        return richTextArray.map((item) => {
            if (!item || typeof item !== "object") {
                return {
                    type: "text",
                    text: {
                        content: String(item || ""),
                    },
                };
            }

            // If already properly structured
            if (
                item.type === "text" &&
                item.text &&
                typeof item.text.content === "string"
            ) {
                return this.deepCopyPreservingArrays(item);
            }

            // If in simplified format {text: {content: "..."}}
            if (item.text && typeof item.text.content === "string") {
                return {
                    type: "text",
                    text: {
                        content: item.text.content,
                    },
                };
            }

            // If just a string
            if (typeof item === "string") {
                return {
                    type: "text",
                    text: {
                        content: item,
                    },
                };
            }

            // If has content property directly
            if (typeof item.content === "string") {
                return {
                    type: "text",
                    text: {
                        content: item.content,
                    },
                };
            }

            // Fallback - convert to string
            return {
                type: "text",
                text: {
                    content: String(item),
                },
            };
        });
    }

    /**
     * Validate and fix block structure for Notion API
     * @param {Array} blocksArray - Array of block objects
     * @returns {Array} - Validated blocks array
     */
    validateBlocksArray(blocksArray) {
        if (!Array.isArray(blocksArray)) {
            console.log(
                `MCP Tool Mapper: validateBlocksArray - input is not an array, returning empty array`
            );
            return [];
        }

        console.log(
            `MCP Tool Mapper: validateBlocksArray - validating ${blocksArray.length} blocks`
        );

        return blocksArray
            .map((block, index) => {
                console.log(
                    `MCP Tool Mapper: Validating block ${index}:`,
                    JSON.stringify(block, null, 2)
                );

                if (!block || typeof block !== "object") {
                    console.log(
                        `MCP Tool Mapper: Block ${index} is invalid, skipping`
                    );
                    return null;
                }

                // Clean the block by removing null/undefined properties
                const cleanBlock = {
                    object: "block",
                };

                for (const [key, value] of Object.entries(block)) {
                    if (
                        value !== null &&
                        value !== undefined &&
                        key !== "bulleted_list_item"
                    ) {
                        cleanBlock[key] = value;
                    }
                }

                // Ensure type is set
                if (!cleanBlock.type) {
                    console.log(
                        `MCP Tool Mapper: Block ${index} missing type, defaulting to paragraph`
                    );
                    cleanBlock.type = "paragraph";
                }

                console.log(
                    `MCP Tool Mapper: Block ${index} after cleaning, type: ${cleanBlock.type}`
                );

                // Validate and fix specific block types according to Notion API requirements
                switch (cleanBlock.type) {
                    case "paragraph":
                        if (!cleanBlock.paragraph) {
                            cleanBlock.paragraph = { rich_text: [] };
                        }
                        if (cleanBlock.paragraph.rich_text) {
                            cleanBlock.paragraph.rich_text =
                                this.validateRichTextArray(
                                    cleanBlock.paragraph.rich_text
                                );
                        }
                        break;

                    case "heading_1":
                    case "heading_2":
                    case "heading_3":
                        const headingProp = cleanBlock.type;
                        if (!cleanBlock[headingProp]) {
                            cleanBlock[headingProp] = { rich_text: [] };
                        }
                        if (cleanBlock[headingProp].rich_text) {
                            cleanBlock[headingProp].rich_text =
                                this.validateRichTextArray(
                                    cleanBlock[headingProp].rich_text
                                );
                        }
                        break;

                    case "bulleted_list_item":
                    case "numbered_list_item":
                        const listProp = cleanBlock.type;
                        if (!cleanBlock[listProp]) {
                            cleanBlock[listProp] = { rich_text: [] };
                        }
                        if (cleanBlock[listProp].rich_text) {
                            cleanBlock[listProp].rich_text =
                                this.validateRichTextArray(
                                    cleanBlock[listProp].rich_text
                                );
                        }
                        break;

                    case "child_database":
                        // child_database blocks require a title property
                        if (!cleanBlock.child_database) {
                            console.log(
                                `MCP Tool Mapper: Block ${index} missing child_database property, adding default`
                            );
                            cleanBlock.child_database = {
                                title: "Untitled Database",
                            };
                        } else if (!cleanBlock.child_database.title) {
                            cleanBlock.child_database.title =
                                "Untitled Database";
                        }
                        break;

                    case "callout":
                        // callout blocks require rich_text and can have an icon
                        if (!cleanBlock.callout) {
                            console.log(
                                `MCP Tool Mapper: Block ${index} missing callout property, adding default`
                            );
                            cleanBlock.callout = {
                                rich_text: [],
                                icon: { emoji: "💡" },
                            };
                        } else {
                            if (!cleanBlock.callout.rich_text) {
                                cleanBlock.callout.rich_text = [];
                            }
                            cleanBlock.callout.rich_text =
                                this.validateRichTextArray(
                                    cleanBlock.callout.rich_text
                                );
                            if (!cleanBlock.callout.icon) {
                                cleanBlock.callout.icon = { emoji: "💡" };
                            }
                        }
                        break;

                    case "to_do":
                        if (!cleanBlock.to_do) {
                            cleanBlock.to_do = {
                                rich_text: [],
                                checked: false,
                            };
                        } else {
                            if (!cleanBlock.to_do.rich_text) {
                                cleanBlock.to_do.rich_text = [];
                            }
                            cleanBlock.to_do.rich_text =
                                this.validateRichTextArray(
                                    cleanBlock.to_do.rich_text
                                );
                            if (cleanBlock.to_do.checked === undefined) {
                                cleanBlock.to_do.checked = false;
                            }
                        }
                        break;

                    case "quote":
                        if (!cleanBlock.quote) {
                            cleanBlock.quote = { rich_text: [] };
                        }
                        if (cleanBlock.quote.rich_text) {
                            cleanBlock.quote.rich_text =
                                this.validateRichTextArray(
                                    cleanBlock.quote.rich_text
                                );
                        }
                        break;

                    case "divider":
                        // Divider blocks don't need additional properties beyond type and object
                        cleanBlock.divider = {};
                        break;

                    default:
                        console.log(
                            `MCP Tool Mapper: Block ${index} has unsupported type '${cleanBlock.type}', converting to paragraph`
                        );
                        cleanBlock.type = "paragraph";
                        cleanBlock.paragraph = { rich_text: [] };
                        break;
                }

                console.log(
                    `MCP Tool Mapper: Block ${index} after validation:`,
                    JSON.stringify(cleanBlock, null, 2)
                );
                return cleanBlock;
            })
            .filter((block) => block !== null);
    }

    /**
     * Log debug information to MCP log file
     * @param {string} serverName - MCP server name
     * @param {string} message - Log message
     * @param {Object} data - Data to log
     */
    logToMcpFile(serverName, message, data = null) {
        try {
            const fs = require("fs");
            const path = require("path");

            const logFile = path.join(
                process.cwd(),
                "assets",
                "logs",
                `${serverName}-mcp.log`
            );
            const timestamp = new Date().toISOString();

            let logEntry = `[${timestamp}] ${message}`;
            if (data) {
                logEntry += `\nData: ${JSON.stringify(data, null, 2)}`;
            }
            logEntry += "\n\n";

            fs.appendFileSync(logFile, logEntry);
        } catch (error) {
            // Ignore logging errors to prevent cascading issues
        }
    }
}

module.exports = { McpToolMapper };
