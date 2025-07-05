/**
 * Simple MCP Tool Mapper - Direct one-to-one field mapping between MCP tools and Gemini handlers
 *
 * Core Concept:
 * 1. Take MCP tool schema → Create Gemini-compliant schema with exact same fields
 * 2. Store bidirectional mapping for each field (name, type, constraints)
 * 3. Handler receives Gemini args → Use stored mapping to convert back to MCP format
 * 4. Call MCP tool with converted args → Return response
 */
class SimpleMcpToolMapper {
    constructor() {
        // Store all handler functions
        this.handlers = new Map();

        // Store field mappings: handlerName → { mcpClient, originalToolName, fieldMappings }
        this.mappings = new Map();

        // Store all function declarations for Gemini
        this.functionDeclarations = [];
    }

    /**
     * Register MCP tools and create corresponding Gemini handler functions
     */
    async registerMcpTools(mcpClient, serverName, tools) {
        console.log(`[SimpleMcpToolMapper] Registering ${tools.length} tools from ${serverName}`);

        for (const tool of tools) {
            try {
                const handlerName = this.generateHandlerName(
                    serverName,
                    tool.name
                );

                // Enhance tool schema to fix known issues
                const enhancedTool = this.enhanceToolSchema(tool, serverName);

                // Create one-to-one field mapping
                const fieldMappings = this.createFieldMappings(
                    enhancedTool.inputSchema
                );

                // Create Gemini-compliant function declaration
                const geminiDeclaration = this.createGeminiDeclaration(
                    enhancedTool,
                    handlerName,
                    fieldMappings
                );

                // Store mapping information
                this.mappings.set(handlerName, {
                    mcpClient,
                    originalToolName: tool.name,
                    fieldMappings,
                    serverName,
                });

                // Create handler function
                this.handlers.set(handlerName, async (geminiArgs) => {
                    return this.executeHandler(handlerName, geminiArgs);
                });

                // Store function declaration
                this.functionDeclarations.push(geminiDeclaration);

            } catch (error) {
                const { getErrorService } = require('../error-service');
                getErrorService().reportError(`Failed to register ${tool.name}: ${error.message}`, "SimpleMcpToolMapper");
            }
        }
    }

    /**
     * Generate consistent handler name
     */
    generateHandlerName(serverName, toolName) {
        // Convert server name to camelCase prefix
        const serverPrefix = serverName.replace(/-/g, "").toLowerCase();

        // Convert tool name to camelCase
        let toolPart = toolName.replace(/^API-/, "").replace(/-/g, "_");
        toolPart = toolPart
            .split("_")
            .map((part, index) => {
                return index === 0
                    ? part.toLowerCase()
                    : part.charAt(0).toUpperCase() +
                          part.slice(1).toLowerCase();
            })
            .join("");

        return (
            serverPrefix + toolPart.charAt(0).toUpperCase() + toolPart.slice(1)
        );
    }

    /**
     * Enhance tool schema to fix known compatibility issues
     */
    enhanceToolSchema(tool, serverName) {
        // Create a deep copy to avoid modifying the original
        const enhancedTool = JSON.parse(JSON.stringify(tool));

        // Fix Notion API compatibility issues
        if (
            serverName.includes("notion") &&
            (tool.name === "post_page" || tool.name === "API-post-page")
        ) {
            enhancedTool.inputSchema = this.enhanceNotionPostPageSchema(
                enhancedTool.inputSchema
            );
        }

        return enhancedTool;
    }

    /**
     * Enhance Notion post_page schema to support proper parent object structure
     */
    enhanceNotionPostPageSchema(originalSchema) {
        if (
            !originalSchema ||
            !originalSchema.properties ||
            !originalSchema.properties.parent
        ) {
            return originalSchema;
        }

        // The enhanced parent object should support both page_id and database_id
        const enhancedSchema = JSON.parse(JSON.stringify(originalSchema));

        // Replace the parent object with a more complete structure
        // Based on Notion API docs: https://developers.notion.com/reference/parent-object
        enhancedSchema.properties.parent = {
            type: "object",
            description:
                'The parent of the new page. For pages in databases, use {"type": "database_id", "database_id": "uuid"}. For pages under other pages, use {"type": "page_id", "page_id": "uuid"}.',
            properties: {
                type: {
                    type: "string",
                    enum: ["database_id", "page_id"],
                    description:
                        'The type of parent. Use "database_id" to create in a database, "page_id" to create under a page.',
                },
                database_id: {
                    type: "string",
                    description:
                        'The ID of the parent database (required when type is "database_id"). Use this to create a new page in a database.',
                },
                page_id: {
                    type: "string",
                    description:
                        'The ID of the parent page (required when type is "page_id"). Use this to create a new page under an existing page.',
                },
            },
            required: ["type"],
        };

        return enhancedSchema;
    }

    /**
     * Create one-to-one field mappings between MCP schema and Gemini schema
     */
    createFieldMappings(mcpSchema) {
        const mappings = {};

        if (!mcpSchema || !mcpSchema.properties) {
            return mappings;
        }

        // Create mapping for each field
        for (const [fieldName, fieldSchema] of Object.entries(
            mcpSchema.properties
        )) {
            mappings[fieldName] = {
                mcpFieldName: fieldName,
                geminiFieldName: fieldName, // 1:1 mapping - same name
                mcpType: fieldSchema.type,
                geminiType: this.convertToGeminiType(fieldSchema.type),
                mcpSchema: fieldSchema,
                geminiSchema: this.convertSchemaToGemini(fieldSchema),
            };
        }

        return mappings;
    }

    /**
     * Convert MCP JSON Schema type to Gemini type
     */
    convertToGeminiType(mcpType) {
        const typeMap = {
            string: "STRING",
            number: "NUMBER",
            integer: "INTEGER",
            boolean: "BOOLEAN",
            array: "ARRAY",
            object: "OBJECT",
        };

        return typeMap[mcpType] || "STRING";
    }

    /**
     * Convert MCP schema property to Gemini schema format
     */
    convertSchemaToGemini(mcpSchema) {
        const geminiSchema = {
            type: this.convertToGeminiType(mcpSchema.type),
        };

        // Copy description
        if (mcpSchema.description) {
            geminiSchema.description = mcpSchema.description;
        }

        // Handle array items
        if (mcpSchema.type === "array" && mcpSchema.items) {
            geminiSchema.items = this.convertSchemaToGemini(mcpSchema.items);
        }

        // Handle object properties
        if (mcpSchema.type === "object" && mcpSchema.properties) {
            geminiSchema.properties = {};
            for (const [propName, propSchema] of Object.entries(
                mcpSchema.properties
            )) {
                geminiSchema.properties[propName] =
                    this.convertSchemaToGemini(propSchema);
            }
        }

        // Handle enum values - CRITICAL: Gemini API only allows enum on STRING types
        // If we have enum values, we must ensure the type is STRING
        if (mcpSchema.enum) {
            // Convert all enum values to strings
            geminiSchema.enum = mcpSchema.enum.map((value) => String(value));

            // CRITICAL: If type is not STRING and we have enum, force type to STRING
            // This is because Gemini API only allows enum fields on STRING types
            if (mcpSchema.type !== "string") {
                console.warn(
                    `Converting type from ${mcpSchema.type} to STRING for enum field`
                );
                geminiSchema.type = "STRING";
            }
        }

        // Handle format field - Only preserve "enum" format, remove others
        // Gemini API only supports format: "enum" according to error messages
        if (mcpSchema.format && mcpSchema.format === "enum") {
            geminiSchema.format = mcpSchema.format;
        } else if (mcpSchema.enum && geminiSchema.type === "STRING") {
            // Add format: "enum" for STRING types that have enum values
            geminiSchema.format = "enum";
        }
        // Note: Other formats like "email", "uri", "date-time", "uuid", "int32", "json" are not supported
        // DO NOT copy format field unless it's "enum"

        // Handle required fields
        if (mcpSchema.required) {
            geminiSchema.required = mcpSchema.required;
        }

        // Skip constraint properties that Gemini API doesn't support well
        // These will be validated during MCP conversion instead
        // Note: Keeping validation logic in the conversion step ensures one-to-one mapping

        // Final cleanup: Remove properties that are not supported by Gemini API
        // Note: enum and format ARE supported, so we preserve them
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
            if (geminiSchema.hasOwnProperty(prop)) {
                delete geminiSchema[prop];
            }
        });

        return geminiSchema;
    }

    /**
     * Create Gemini function declaration from MCP tool
     */
    createGeminiDeclaration(mcpTool, handlerName, fieldMappings) {
        const geminiProperties = {};
        const required = [];

        // Convert each field using the mapping
        for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
            geminiProperties[mapping.geminiFieldName] = mapping.geminiSchema;
        }

        // Handle required fields from original schema
        if (mcpTool.inputSchema && mcpTool.inputSchema.required) {
            required.push(...mcpTool.inputSchema.required);
        }

        const declaration = {
            name: handlerName,
            description: mcpTool.description || `MCP tool: ${mcpTool.name}`,
            parameters: {
                type: "OBJECT",
                properties: geminiProperties,
            },
        };

        if (required.length > 0) {
            declaration.parameters.required = required;
        }

        // Final validation: Remove any unsupported properties that might have leaked through
        // Note: enum and format are now supported, so we don't clean them
        this.cleanGeminiDeclaration(declaration);

        return declaration;
    }

    /**
     * Clean a Gemini declaration to remove any unsupported properties
     * Note: enum and format are now supported by Gemini API, so we preserve them
     */
    cleanGeminiDeclaration(declaration) {
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

        function cleanObject(obj) {
            if (!obj || typeof obj !== "object") return;

            // Remove unsupported properties (but preserve enum and format)
            unsupportedProps.forEach((prop) => {
                if (obj.hasOwnProperty(prop)) {
                    delete obj[prop];
                }
            });

            // Handle format field - Only preserve "enum" format, remove others
            // Gemini API only supports format: "enum"
            if (obj.format && obj.format !== "enum") {
                delete obj.format;
            }

            // CRITICAL: Handle enum fields - Gemini API only allows enum on STRING types
            if (obj.enum && Array.isArray(obj.enum)) {
                // Convert all enum values to strings
                obj.enum = obj.enum.map((value) => String(value));

                // CRITICAL: If type is not STRING and we have enum, force type to STRING
                // This is because Gemini API only allows enum fields on STRING types
                if (obj.type && obj.type !== "STRING") {
                    console.warn(
                        `Converting type from ${obj.type} to STRING for enum field`
                    );
                    obj.type = "STRING";
                }
            }

            // Recursively clean nested objects
            Object.values(obj).forEach((value) => {
                if (typeof value === "object" && value !== null) {
                    cleanObject(value);
                }
            });
        }

        cleanObject(declaration);
    }

    /**
     * Execute a handler by converting Gemini args back to MCP format
     */
    async executeHandler(handlerName, geminiArgs) {
        const mapping = this.mappings.get(handlerName);
        if (!mapping) {
            throw new Error(`No mapping found for handler: ${handlerName}`);
        }

        console.log(
            `SimpleMcpToolMapper: Executing ${handlerName} with Gemini args:`,
            geminiArgs
        );

        // Convert Gemini args back to MCP format using stored mappings
        let mcpArgs = this.convertGeminiArgsToMcp(
            geminiArgs,
            mapping.fieldMappings
        );

        // Apply custom conversions for specific tools
        mcpArgs = this.applyCustomConversions(handlerName, mcpArgs);

        // Clean null/undefined values from the final arguments
        mcpArgs = this.cleanNullValues(mcpArgs);

        try {
            // Call the actual MCP tool
            const response = await mapping.mcpClient.callTool({
                name: mapping.originalToolName,
                arguments: mcpArgs,
            });

            if (response.isError) {
                throw new Error(`MCP Error: ${response.content}`);
            }

            return response.content;
        } catch (error) {
            const { getErrorService } = require('../error-service');
            getErrorService().reportError(`Error calling MCP tool ${mapping.originalToolName}: ${error.message}`, "SimpleMcpToolMapper");
            throw error;
        }
    }

    /**
     * Convert Gemini arguments back to MCP format using stored field mappings
     */
    convertGeminiArgsToMcp(geminiArgs, fieldMappings) {
        const mcpArgs = {};

        // Convert each field using the stored mapping
        for (const [fieldName, value] of Object.entries(geminiArgs)) {
            const mapping = fieldMappings[fieldName];
            if (!mapping) {
                console.warn(
                    `SimpleMcpToolMapper: No mapping found for field: ${fieldName}`
                );
                mcpArgs[fieldName] = value; // Pass through as-is
                continue;
            }

            // Convert and validate value from Gemini format to MCP format
            mcpArgs[mapping.mcpFieldName] = this.convertAndValidateValue(
                value,
                mapping.mcpType,
                mapping.geminiType,
                mapping.mcpSchema,
                fieldName
            );
        }

        return mcpArgs;
    }

    /**
     * Convert a value from Gemini type to MCP type with constraint validation
     */
    convertAndValidateValue(value, mcpType, geminiType, mcpSchema, fieldName) {
        // Filter out null and undefined values - they should not be passed to MCP
        if (value === null || value === undefined) {
            return undefined; // This will be filtered out by JSON.stringify
        }

        // Convert type if needed
        let convertedValue = value;

        // Special handling for enum fields that were converted from NUMBER/INTEGER to STRING
        // If the original MCP type was number/integer but we have enum values,
        // we need to convert the string back to the numeric type
        if (
            (mcpType === "number" || mcpType === "integer") &&
            mcpSchema.enum &&
            typeof value === "string"
        ) {
            if (mcpType === "number") {
                convertedValue = parseFloat(value);
            } else if (mcpType === "integer") {
                convertedValue = parseInt(value, 10);
            }
        } else if (mcpType === "number" && typeof value === "string") {
            convertedValue = parseFloat(value);
        } else if (mcpType === "integer" && typeof value === "string") {
            convertedValue = parseInt(value, 10);
        } else if (mcpType === "boolean" && typeof value === "string") {
            convertedValue = value.toLowerCase() === "true";
        }

        // Validate against MCP schema constraints
        if (mcpSchema) {
            this.validateConstraints(convertedValue, mcpSchema, fieldName);
        }

        return convertedValue;
    }

    /**
     * Validate value against MCP schema constraints
     */
    validateConstraints(value, mcpSchema, fieldName) {
        // Validate enum values
        if (mcpSchema.enum) {
            // Handle both original enum values and string-converted values
            // This accounts for cases where we converted NUMBER enum to STRING enum for Gemini API
            const enumMatches =
                mcpSchema.enum.includes(value) ||
                mcpSchema.enum.includes(String(value)) ||
                mcpSchema.enum.map((v) => String(v)).includes(String(value));

            if (!enumMatches) {
                throw new Error(
                    `Invalid value for ${fieldName}: ${value}. Valid values: ${mcpSchema.enum.join(
                        ", "
                    )}`
                );
            }
        }

        // Validate number constraints
        if (typeof value === "number") {
            if (mcpSchema.minimum !== undefined && value < mcpSchema.minimum) {
                throw new Error(
                    `Value for ${fieldName} must be >= ${mcpSchema.minimum}, got ${value}`
                );
            }
            if (mcpSchema.maximum !== undefined && value > mcpSchema.maximum) {
                throw new Error(
                    `Value for ${fieldName} must be <= ${mcpSchema.maximum}, got ${value}`
                );
            }
        }

        // Validate string constraints
        if (typeof value === "string") {
            if (
                mcpSchema.minLength !== undefined &&
                value.length < mcpSchema.minLength
            ) {
                throw new Error(
                    `String length for ${fieldName} must be >= ${mcpSchema.minLength}, got ${value.length}`
                );
            }
            if (
                mcpSchema.maxLength !== undefined &&
                value.length > mcpSchema.maxLength
            ) {
                throw new Error(
                    `String length for ${fieldName} must be <= ${mcpSchema.maxLength}, got ${value.length}`
                );
            }
        }

        // Validate array constraints
        if (Array.isArray(value)) {
            if (
                mcpSchema.minItems !== undefined &&
                value.length < mcpSchema.minItems
            ) {
                throw new Error(
                    `Array length for ${fieldName} must be >= ${mcpSchema.minItems}, got ${value.length}`
                );
            }
            if (
                mcpSchema.maxItems !== undefined &&
                value.length > mcpSchema.maxItems
            ) {
                throw new Error(
                    `Array length for ${fieldName} must be <= ${mcpSchema.maxItems}, got ${value.length}`
                );
            }
        }
    }

    /**
     * Get all handler declarations for Gemini
     */
    getHandlerDeclarations() {
        return this.functionDeclarations;
    }

    /**
     * Check if a function name is a registered handler
     */
    isHandler(functionName) {
        return this.handlers.has(functionName);
    }

    /**
     * Get debug information
     */
    getDebugInfo() {
        return {
            totalHandlers: this.handlers.size,
            handlers: Array.from(this.handlers.keys()),
            mappings: Array.from(this.mappings.entries()).map(
                ([name, mapping]) => ({
                    handler: name,
                    server: mapping.serverName,
                    originalTool: mapping.originalToolName,
                    fieldCount: Object.keys(mapping.fieldMappings).length,
                })
            ),
        };
    }

    /**
     * Validate that all mappings are correct (for testing)
     */
    validateMappings() {
        const issues = [];

        for (const [handlerName, mapping] of this.mappings.entries()) {
            // Check that handler exists
            if (!this.handlers.has(handlerName)) {
                issues.push(
                    `Handler ${handlerName} has mapping but no handler function`
                );
            }

            // Check that declaration exists
            const declaration = this.functionDeclarations.find(
                (d) => d.name === handlerName
            );
            if (!declaration) {
                issues.push(
                    `Handler ${handlerName} has mapping but no function declaration`
                );
            }

            // Validate field mappings
            for (const [fieldName, fieldMapping] of Object.entries(
                mapping.fieldMappings
            )) {
                if (
                    fieldMapping.mcpFieldName !== fieldMapping.geminiFieldName
                ) {
                    issues.push(
                        `Field ${fieldName} in ${handlerName} has non-1:1 mapping`
                    );
                }
            }
        }

        return issues;
    }

    /**
     * Apply custom conversions for specific tools (e.g., Notion parent object structure)
     */
    applyCustomConversions(handlerName, mcpArgs) {
        // Handle Notion post_page parent object conversion
        if (
            handlerName.toLowerCase().includes("notion") &&
            handlerName.toLowerCase().includes("postpage")
        ) {
            return this.convertNotionPostPageParent(mcpArgs);
        }

        return mcpArgs;
    }

    /**
     * Convert Notion post_page parent object to proper API format
     */
    convertNotionPostPageParent(mcpArgs) {
        if (!mcpArgs.parent || typeof mcpArgs.parent !== "object") {
            // Handle case where parent is a string (just an ID)
            if (typeof mcpArgs.parent === "string") {
                console.log(
                    "SimpleMcpToolMapper: Converting string parent to database_id structure"
                );
                return {
                    ...mcpArgs,
                    parent: {
                        type: "database_id",
                        database_id: mcpArgs.parent,
                    },
                };
            }
            return mcpArgs;
        }

        const parent = mcpArgs.parent;

        // Check if the parent object has the correct structure
        // Correct structure means: type matches the ID field (database_id <-> database_id, page_id <-> page_id)
        const hasCorrectStructure =
            (parent.type === "database_id" &&
                parent.database_id &&
                !parent.page_id) ||
            (parent.type === "page_id" &&
                parent.page_id &&
                !parent.database_id);

        if (hasCorrectStructure) {
            return mcpArgs;
        }

        // Handle cases where Gemini might pass incorrect parent structure
        let convertedParent = { ...parent };

        // If we have a page_id but the type suggests database, convert it
        if (parent.page_id && parent.type === "database_id") {
            convertedParent = {
                type: "database_id",
                database_id: parent.page_id,
            };
        }
        // If we have a database_id but the type suggests page, convert it
        else if (parent.database_id && parent.type === "page_id") {
            convertedParent = {
                type: "page_id",
                page_id: parent.database_id,
            };
        }
        // If we have page_id and no type, we need to make an educated guess
        // Since most use cases are creating pages in databases, and the error suggests
        // this ID is actually a database ID, let's default to database_id
        else if (parent.page_id && !parent.type) {
            convertedParent = {
                type: "database_id",
                database_id: parent.page_id,
            };
        }
        // If we have database_id and no type, assume it's a database parent
        else if (parent.database_id && !parent.type) {
            convertedParent = {
                type: "database_id",
                database_id: parent.database_id,
            };
        }
        // If we have both page_id and database_id, prioritize based on type
        else if (parent.page_id && parent.database_id) {
            if (parent.type === "database_id") {
                convertedParent = {
                    type: "database_id",
                    database_id: parent.database_id,
                };
            } else {
                convertedParent = {
                    type: "page_id",
                    page_id: parent.page_id,
                };
            }
        }

        return {
            ...mcpArgs,
            parent: convertedParent,
        };
    }

    /**
     * Clean null and undefined values from an object recursively
     */
    cleanNullValues(obj) {
        if (obj === null || obj === undefined) {
            return undefined;
        }

        if (Array.isArray(obj)) {
            return obj
                .map((item) => this.cleanNullValues(item))
                .filter((item) => item !== undefined);
        }

        if (typeof obj === "object") {
            const cleaned = {};
            for (const [key, value] of Object.entries(obj)) {
                const cleanedValue = this.cleanNullValues(value);
                if (cleanedValue !== undefined) {
                    cleaned[key] = cleanedValue;
                }
            }
            return cleaned;
        }

        return obj;
    }
}

module.exports = { SimpleMcpToolMapper };
