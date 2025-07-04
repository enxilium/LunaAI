const {
    SimpleMcpToolMapper,
} = require("../services/agent/simple-mcp-tool-mapper");

/**
 * Comprehensive validation suite for MCP Tool Mapper
 *
 * This script:
 * 1. Validates Gemini API compliance using the official TypeScript definitions
 * 2. Tests every one-to-one conversion between MCP tools and Gemini handler functions
 * 3. Scales automatically as new MCP servers are added
 * 4. Can be integrated into app startup for continuous validation
 */
class McpMappingValidator {
    constructor() {
        this.issues = [];
        this.stats = {
            serversValidated: 0,
            toolsValidated: 0,
            fieldsValidated: 0,
            conversionsValidated: 0,
        };
    }

    /**
     * Validate Gemini API compliance for function declarations
     * Based on @google/genai TypeScript definitions
     */
    validateGeminiApiCompliance(functionDeclarations) {
        console.log("🔍 Validating Gemini API compliance...");

        for (const declaration of functionDeclarations) {
            this.validateFunctionDeclaration(declaration);
        }
    }

    /**
     * Validate a single function declaration against Gemini API spec
     */
    validateFunctionDeclaration(declaration) {
        const context = `Function ${declaration.name}`;

        // Required fields
        if (!declaration.name || typeof declaration.name !== "string") {
            this.addIssue(
                "CRITICAL",
                `${context}: Missing or invalid 'name' field`
            );
        }

        if (
            !declaration.description ||
            typeof declaration.description !== "string"
        ) {
            this.addIssue(
                "WARNING",
                `${context}: Missing or invalid 'description' field`
            );
        }

        // Parameters validation
        if (declaration.parameters) {
            this.validateParameters(declaration.parameters, context);
        }
    }

    /**
     * Validate parameters object against Gemini Schema spec
     */
    validateParameters(parameters, context) {
        // Type must be uppercase
        if (!parameters.type || parameters.type !== "OBJECT") {
            this.addIssue(
                "CRITICAL",
                `${context}: Parameters type must be 'OBJECT'`
            );
        }

        // Properties validation
        if (parameters.properties) {
            for (const [propName, propSchema] of Object.entries(
                parameters.properties
            )) {
                this.validateSchemaProperty(
                    propSchema,
                    `${context}.${propName}`
                );
            }
        }

        // Required fields validation
        if (parameters.required) {
            if (!Array.isArray(parameters.required)) {
                this.addIssue(
                    "CRITICAL",
                    `${context}: 'required' must be an array`
                );
            }
        }
    }

    /**
     * Validate schema property against Gemini Schema spec
     */
    validateSchemaProperty(schema, context) {
        // Valid Gemini types
        const validTypes = [
            "STRING",
            "NUMBER",
            "INTEGER",
            "BOOLEAN",
            "ARRAY",
            "OBJECT",
        ];

        if (!schema.type || !validTypes.includes(schema.type)) {
            this.addIssue(
                "CRITICAL",
                `${context}: Invalid type '${
                    schema.type
                }'. Must be one of: ${validTypes.join(", ")}`
            );
        }

        // Description should be string
        if (schema.description && typeof schema.description !== "string") {
            this.addIssue(
                "WARNING",
                `${context}: Description must be a string`
            );
        }

        // Enum validation
        if (schema.enum) {
            if (!Array.isArray(schema.enum)) {
                this.addIssue(
                    "CRITICAL",
                    `${context}: 'enum' must be an array`
                );
            } else if (schema.type === "STRING") {
                // For STRING type with enum, all values must be strings
                for (const enumValue of schema.enum) {
                    if (typeof enumValue !== "string") {
                        this.addIssue(
                            "CRITICAL",
                            `${context}: Enum value '${enumValue}' must be string for STRING type`
                        );
                    }
                }
                // Should have format: 'enum'
                if (schema.format !== "enum") {
                    this.addIssue(
                        "WARNING",
                        `${context}: STRING type with enum should have format: 'enum'`
                    );
                }
            }
        }

        // Array validation
        if (schema.type === "ARRAY") {
            if (!schema.items) {
                this.addIssue(
                    "CRITICAL",
                    `${context}: ARRAY type must have 'items' property`
                );
            } else {
                this.validateSchemaProperty(schema.items, `${context}[items]`);
            }
        }

        // Object validation
        if (schema.type === "OBJECT" && schema.properties) {
            for (const [propName, propSchema] of Object.entries(
                schema.properties
            )) {
                this.validateSchemaProperty(
                    propSchema,
                    `${context}.${propName}`
                );
            }
        }

        // Constraint validation (should be strings for Gemini)
        const constraints = [
            "minimum",
            "maximum",
            "minLength",
            "maxLength",
            "minItems",
            "maxItems",
            "minProperties",
            "maxProperties",
        ];
        for (const constraint of constraints) {
            if (
                schema[constraint] !== undefined &&
                typeof schema[constraint] !== "string"
            ) {
                this.addIssue(
                    "WARNING",
                    `${context}: Constraint '${constraint}' should be a string for Gemini API`
                );
            }
        }
    }

    /**
     * Test every one-to-one conversion between MCP and Gemini
     */
    async testOneToOneConversions(mapper) {
        console.log("🧪 Testing one-to-one conversions...");

        const mappings = mapper.mappings;

        for (const [handlerName, mapping] of mappings.entries()) {
            await this.testSingleToolConversion(handlerName, mapping, mapper);
        }
    }

    /**
     * Test conversion for a single tool
     */
    async testSingleToolConversion(handlerName, mapping, mapper) {
        console.log(`  Testing ${handlerName}...`);

        // Test field mappings
        for (const [fieldName, fieldMapping] of Object.entries(
            mapping.fieldMappings
        )) {
            this.validateFieldMapping(fieldMapping, handlerName);
            this.stats.fieldsValidated++;
        }

        // Test round-trip conversion with sample data
        const testCases = this.generateTestCases(mapping.fieldMappings);

        for (const testCase of testCases) {
            try {
                const mcpArgs = mapper.convertGeminiArgsToMcp(
                    testCase.geminiArgs,
                    mapping.fieldMappings
                );

                // Validate conversion
                this.validateConversion(
                    testCase.geminiArgs,
                    mcpArgs,
                    mapping.fieldMappings,
                    handlerName
                );
                this.stats.conversionsValidated++;
            } catch (error) {
                this.addIssue(
                    "ERROR",
                    `${handlerName}: Conversion failed for test case: ${error.message}`
                );
            }
        }

        this.stats.toolsValidated++;
    }

    /**
     * Validate a single field mapping
     */
    validateFieldMapping(fieldMapping, handlerName) {
        const context = `${handlerName}.${fieldMapping.geminiFieldName}`;

        // Ensure one-to-one mapping
        if (fieldMapping.mcpFieldName !== fieldMapping.geminiFieldName) {
            this.addIssue(
                "ERROR",
                `${context}: Not a 1:1 mapping (MCP: ${fieldMapping.mcpFieldName} ≠ Gemini: ${fieldMapping.geminiFieldName})`
            );
        }

        // Ensure type conversion is valid
        const validConversions = {
            string: ["STRING"],
            number: ["NUMBER", "STRING"],
            integer: ["INTEGER", "NUMBER", "STRING"],
            boolean: ["BOOLEAN", "STRING"],
            array: ["ARRAY"],
            object: ["OBJECT"],
        };

        const allowedGeminiTypes = validConversions[fieldMapping.mcpType] || [];
        if (!allowedGeminiTypes.includes(fieldMapping.geminiType)) {
            this.addIssue(
                "ERROR",
                `${context}: Invalid type conversion ${fieldMapping.mcpType} → ${fieldMapping.geminiType}`
            );
        }
    }

    /**
     * Generate test cases for field mappings
     */
    generateTestCases(fieldMappings) {
        const testCases = [];

        // Empty case
        testCases.push({ geminiArgs: {} });

        // Single field cases
        for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
            const testValues = this.generateTestValues(mapping.geminiType);

            for (const testValue of testValues) {
                testCases.push({
                    geminiArgs: { [fieldName]: testValue },
                });
            }
        }

        // Multi-field case
        if (Object.keys(fieldMappings).length > 1) {
            const multiFieldArgs = {};
            for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
                const testValues = this.generateTestValues(mapping.geminiType);
                multiFieldArgs[fieldName] = testValues[0]; // Use first test value
            }
            testCases.push({ geminiArgs: multiFieldArgs });
        }

        return testCases;
    }

    /**
     * Generate test values for a Gemini type
     */
    generateTestValues(geminiType) {
        switch (geminiType) {
            case "STRING":
                return ["test", "", "hello world"];
            case "NUMBER":
                return [42, 3.14, 0, -1];
            case "INTEGER":
                return [42, 0, -1];
            case "BOOLEAN":
                return [true, false];
            case "ARRAY":
                return [[], ["item1", "item2"]];
            case "OBJECT":
                return [{}, { key: "value" }];
            default:
                return ["default"];
        }
    }

    /**
     * Validate a conversion between Gemini and MCP arguments
     */
    validateConversion(geminiArgs, mcpArgs, fieldMappings, handlerName) {
        // Check that all Gemini fields were converted
        for (const geminiField of Object.keys(geminiArgs)) {
            const mapping = fieldMappings[geminiField];
            if (mapping && !mcpArgs.hasOwnProperty(mapping.mcpFieldName)) {
                this.addIssue(
                    "ERROR",
                    `${handlerName}: Gemini field '${geminiField}' not converted to MCP`
                );
            }
        }

        // Check that conversion preserves data integrity
        for (const [geminiField, geminiValue] of Object.entries(geminiArgs)) {
            const mapping = fieldMappings[geminiField];
            if (mapping) {
                const mcpValue = mcpArgs[mapping.mcpFieldName];

                // Type-specific validation
                if (
                    mapping.mcpType === "string" &&
                    typeof mcpValue !== "string"
                ) {
                    this.addIssue(
                        "ERROR",
                        `${handlerName}.${geminiField}: MCP value should be string, got ${typeof mcpValue}`
                    );
                }

                if (
                    mapping.mcpType === "number" &&
                    typeof mcpValue !== "number"
                ) {
                    this.addIssue(
                        "ERROR",
                        `${handlerName}.${geminiField}: MCP value should be number, got ${typeof mcpValue}`
                    );
                }

                if (
                    mapping.mcpType === "boolean" &&
                    typeof mcpValue !== "boolean"
                ) {
                    this.addIssue(
                        "ERROR",
                        `${handlerName}.${geminiField}: MCP value should be boolean, got ${typeof mcpValue}`
                    );
                }
            }
        }
    }

    /**
     * Validate against mock MCP tools
     */
    async validateWithMockMcpTools() {
        console.log("🎭 Testing with mock MCP tools...");

        const mockMcpTools = this.createMockMcpTools();
        const mapper = new SimpleMcpToolMapper();

        for (const [serverName, tools] of Object.entries(mockMcpTools)) {
            const mockClient = this.createMockMcpClient();
            await mapper.registerMcpTools(mockClient, serverName, tools);
            this.stats.serversValidated++;
        }

        // Validate Gemini API compliance
        const declarations = mapper.getHandlerDeclarations();
        this.validateGeminiApiCompliance(declarations);

        // Test conversions
        await this.testOneToOneConversions(mapper);

        // Validate internal consistency
        const mappingIssues = mapper.validateMappings();
        for (const issue of mappingIssues) {
            this.addIssue("ERROR", issue);
        }

        return mapper;
    }

    /**
     * Create mock MCP tools for testing
     */
    createMockMcpTools() {
        return {
            "test-server": [
                {
                    name: "simple-tool",
                    description: "A simple test tool",
                    inputSchema: {
                        type: "object",
                        properties: {
                            message: {
                                type: "string",
                                description: "A message",
                            },
                            count: { type: "integer", description: "A count" },
                            enabled: {
                                type: "boolean",
                                description: "Whether enabled",
                            },
                        },
                        required: ["message"],
                    },
                },
                {
                    name: "complex-tool",
                    description: "A complex test tool",
                    inputSchema: {
                        type: "object",
                        properties: {
                            config: {
                                type: "object",
                                properties: {
                                    timeout: { type: "number" },
                                    retries: { type: "integer" },
                                },
                            },
                            items: {
                                type: "array",
                                items: { type: "string" },
                            },
                            priority: {
                                type: "string",
                                enum: ["low", "medium", "high"],
                            },
                        },
                    },
                },
            ],
            notion: [
                {
                    name: "API-post-page",
                    description: "Create a page",
                    inputSchema: {
                        type: "object",
                        properties: {
                            parent: {
                                type: "object",
                                properties: {
                                    database_id: { type: "string" },
                                    page_id: { type: "string" },
                                },
                            },
                            properties: {
                                type: "object",
                                description: "Page properties",
                            },
                        },
                        required: ["parent", "properties"],
                    },
                },
            ],
        };
    }

    /**
     * Create mock MCP client
     */
    createMockMcpClient() {
        return {
            callTool: async ({ name, arguments: args }) => {
                return {
                    isError: false,
                    content: `Mock response for ${name} with args: ${JSON.stringify(
                        args
                    )}`,
                };
            },
        };
    }

    /**
     * Add an issue to the validation results
     */
    addIssue(severity, message) {
        this.issues.push({ severity, message });

        const emoji = {
            CRITICAL: "🚨",
            ERROR: "❌",
            WARNING: "⚠️",
        };

        console.log(`${emoji[severity]} ${severity}: ${message}`);
    }

    /**
     * Generate validation report
     */
    generateReport() {
        const criticalCount = this.issues.filter(
            (i) => i.severity === "CRITICAL"
        ).length;
        const errorCount = this.issues.filter(
            (i) => i.severity === "ERROR"
        ).length;
        const warningCount = this.issues.filter(
            (i) => i.severity === "WARNING"
        ).length;

        console.log("\n📊 VALIDATION REPORT");
        console.log("==================");
        console.log(`Servers validated: ${this.stats.serversValidated}`);
        console.log(`Tools validated: ${this.stats.toolsValidated}`);
        console.log(`Fields validated: ${this.stats.fieldsValidated}`);
        console.log(
            `Conversions validated: ${this.stats.conversionsValidated}`
        );
        console.log("");
        console.log(`🚨 Critical issues: ${criticalCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`⚠️  Warnings: ${warningCount}`);

        const success = criticalCount === 0 && errorCount === 0;
        console.log(
            `\n${success ? "✅ VALIDATION PASSED" : "❌ VALIDATION FAILED"}`
        );

        return {
            success,
            stats: this.stats,
            issues: this.issues,
            summary: { criticalCount, errorCount, warningCount },
        };
    }

    /**
     * Main validation entry point
     */
    async runValidation() {
        console.log("🚀 Starting MCP Tool Mapper Validation\n");

        try {
            await this.validateWithMockMcpTools();
            return this.generateReport();
        } catch (error) {
            this.addIssue(
                "CRITICAL",
                `Validation failed with error: ${error.message}`
            );
            return this.generateReport();
        }
    }
}

// Export for use in app startup
module.exports = { McpMappingValidator };

// Run validation if called directly
if (require.main === module) {
    const validator = new McpMappingValidator();
    validator.runValidation().then((result) => {
        process.exit(result.success ? 0 : 1);
    });
}
