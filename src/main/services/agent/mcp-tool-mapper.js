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

                // Store the mapping
                this.handlerToMcpMap.set(handlerName, {
                    serverName,
                    originalToolName: tool.name,
                    originalSchema: tool.inputSchema,
                    client,
                    parameterMapping: this.createParameterMapping(
                        tool.inputSchema
                    ),
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

                // Transform Gemini args to MCP format
                const mcpArgs = this.transformArgsToMcp(
                    args,
                    mcpMapping.parameterMapping
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

                // Call the actual MCP tool with timeout monitoring
                const response = await Promise.race([
                    mcpMapping.client.callTool({
                        name: mcpMapping.originalToolName,
                        arguments: mcpArgs,
                    }),
                    new Promise((_, reject) =>
                        setTimeout(
                            () => reject(new Error("Custom timeout after 30s")),
                            30000
                        )
                    ),
                ]);

                const endTime = Date.now();
                console.log(
                    `MCP Tool Mapper: ${serverName} call completed in ${
                        endTime - startTime
                    }ms`
                );

                // Process and return the response
                if (response) {
                    if (response.isError) {
                        throw new Error(`MCP Tool Error: ${response.content}`);
                    }
                    return this.formatMcpResponse(response);
                } else {
                    throw new Error("No response received from MCP tool");
                }
            } catch (error) {
                console.error(
                    `MCP Tool Mapper: Error executing ${handlerName}:`,
                    error
                );
                throw error;
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

        // Process properties
        if (schema.properties) {
            geminiSchema.properties = this.processSchemaProperties(
                schema.properties
            );
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
                        console.log('MCP Tool Mapper: Adding database_id support to parent object with additionalProperties: true');
                        processed.properties.database_id = {
                            type: "STRING",
                            description: "Database ID for creating pages in databases"
                        };
                        processed.properties.type = {
                            type: "STRING", 
                            enum: ["page_id", "database_id", "workspace"],
                            description: "Type of parent (page_id, database_id, or workspace)"
                        };
                        processed.properties.workspace = {
                            type: "BOOLEAN",
                            description: "Set to true for workspace parent"
                        };
                        
                        // Make page_id optional since we now have alternatives
                        if (processed.required && processed.required.includes('page_id')) {
                            processed.required = processed.required.filter(req => req !== 'page_id');
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
            // Note: 'format' property is not supported by Gemini API, so we omit it
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

        return processed;
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
     * Transform Gemini arguments to MCP format
     * @param {Object} geminiArgs - Arguments from Gemini
     * @param {Object} mapping - Parameter mapping configuration
     * @returns {Object} - MCP-formatted arguments
     */
    transformArgsToMcp(geminiArgs, mapping) {
        const mcpArgs = {};

        // Copy direct properties (excluding null/undefined values)
        for (const key of mapping.direct) {
            if (geminiArgs.hasOwnProperty(key) && geminiArgs[key] != null) {
                mcpArgs[key] = geminiArgs[key];
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
                        mcpArgs[key] = geminiArgs[key];
                        break;

                    case "enumTypeConversion":
                        // Convert string enum values back to original numeric type
                        mcpArgs[key] = this.convertEnumValue(
                            geminiArgs[key],
                            mapping.typeConversions[key]
                        );
                        break;

                    default:
                        mcpArgs[key] = geminiArgs[key];
                }
            }
        }

        // Handle nested objects (with special handling for parent objects)
        for (const [key, nestedMapping] of Object.entries(mapping.nested)) {
            if (geminiArgs.hasOwnProperty(key) && geminiArgs[key]) {
                if (key === 'parent') {
                    // Special handling for Notion parent objects
                    mcpArgs[key] = this.transformNotionParent(geminiArgs[key]);
                } else {
                    mcpArgs[key] = this.transformArgsToMcp(
                        geminiArgs[key],
                        nestedMapping
                    );
                }
            }
        }

        // Handle dynamic properties (additionalProperties)
        for (const [key, dynamicConfig] of Object.entries(
            mapping.dynamicProperties
        )) {
            if (geminiArgs.hasOwnProperty(key) && geminiArgs[key]) {
                if (key === 'parent') {
                    // Special handling for Notion parent objects
                    mcpArgs[key] = this.transformNotionParent(geminiArgs[key]);
                } else {
                    mcpArgs[key] = this.transformDynamicProperties(
                        geminiArgs[key],
                        dynamicConfig
                    );
                }
            }
        }

        return mcpArgs;
    }

    /**
     * Transform Notion parent object, filtering out null values and ensuring proper format
     * @param {Object} parentObj - Parent object from Gemini
     * @returns {Object} - Cleaned parent object for Notion API
     */
    transformNotionParent(parentObj) {
        if (!parentObj || typeof parentObj !== 'object') {
            return parentObj;
        }

        const cleaned = {};
        
        // Only include non-null properties
        for (const [key, value] of Object.entries(parentObj)) {
            if (value != null) {
                cleaned[key] = value;
            }
        }

        // Validate that we have exactly one parent type
        const validParentKeys = ['page_id', 'database_id', 'workspace'];
        const presentKeys = Object.keys(cleaned).filter(key => validParentKeys.includes(key));
        
        if (presentKeys.length === 0) {
            console.warn('MCP Tool Mapper: No valid parent type found, defaulting to database_id if available');
            // If we have a type field, try to use it
            if (cleaned.type === 'database_id' && !cleaned.database_id) {
                console.warn('MCP Tool Mapper: type is database_id but database_id value is missing');
            }
        } else if (presentKeys.length > 1) {
            console.warn(`MCP Tool Mapper: Multiple parent types found: ${presentKeys.join(', ')}, using first one`);
            // Keep only the first valid parent type
            const keepKey = presentKeys[0];
            const result = {};
            result[keepKey] = cleaned[keepKey];
            
            // Add type field if it makes sense
            if (keepKey === 'database_id') {
                result.type = 'database_id';
            } else if (keepKey === 'page_id') {
                result.type = 'page_id';
            } else if (keepKey === 'workspace') {
                result.workspace = true;
            }
            
            console.log(`MCP Tool Mapper: Cleaned parent object:`, result);
            return result;
        }

        console.log(`MCP Tool Mapper: Cleaned parent object:`, cleaned);
        return cleaned;
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
                    if (typeof propValue === "object" && propValue !== null) {
                        transformed[propKey] = this.transformObjectValue(
                            propValue,
                            dynamicConfig.additionalProperties
                        );
                    } else {
                        transformed[propKey] = propValue;
                    }
                } else {
                    transformed[propKey] = propValue;
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
}

module.exports = { McpToolMapper };
