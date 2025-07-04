const { McpMappingValidator } = require("./mcp-mapping-validator");

/**
 * Startup validation module for MCP tool mapping
 * Integrates into app startup to ensure MCP tools are properly validated
 */
class StartupMcpValidator {
    constructor() {
        this.validator = new McpMappingValidator();
    }

    /**
     * Run startup validation on MCP tool mapper - VALIDATES REAL MCP TOOLS
     * This is called during app initialization after MCP tools are registered
     */
    async validateMcpToolMapper(mcpToolMapper) {
        console.log("🔍 Starting MCP Tool Mapper startup validation...");

        try {
            // Get all handler declarations for validation
            const handlerDeclarations = mcpToolMapper.getHandlerDeclarations();

            if (handlerDeclarations.length === 0) {
                console.log("ℹ️  No MCP tools registered, skipping validation");
                return { success: true, message: "No MCP tools to validate" };
            }

            console.log(
                `🔍 Validating ${handlerDeclarations.length} REAL MCP tool handlers...`
            );

            // Get debug info to show what tools we're validating
            const debugInfo = mcpToolMapper.getDebugInfo();
            console.log("Real MCP tools being validated:");
            debugInfo.mappings.forEach((mapping) => {
                console.log(
                    `  - ${mapping.handler} (${mapping.server}.${mapping.originalTool}) - ${mapping.fieldCount} fields`
                );
            });

            // Validate Gemini API compliance
            this.validator.validateGeminiApiCompliance(handlerDeclarations);

            // Test one-to-one conversions with actual registered tools
            await this.validator.testOneToOneConversions(mcpToolMapper);

            // Validate internal consistency
            const mappingIssues = mcpToolMapper.validateMappings();
            for (const issue of mappingIssues) {
                this.validator.addIssue("ERROR", issue);
            }

            // Generate report
            const report = this.validator.generateReport();

            // Log results
            if (report.success) {
                console.log(
                    `✅ REAL MCP tools startup validation passed - ${report.stats.toolsValidated} tools, ${report.stats.fieldsValidated} fields, ${report.stats.conversionsValidated} conversions tested`
                );
            } else {
                console.warn(
                    `⚠️  REAL MCP tools startup validation completed with issues - ${report.summary.criticalCount} critical, ${report.summary.errorCount} errors, ${report.summary.warningCount} warnings`
                );

                // Log critical issues
                const criticalIssues = report.issues.filter(
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

            return {
                success: report.success,
                stats: report.stats,
                issues: report.issues,
                summary: report.summary,
                realToolsValidated: true,
            };
        } catch (error) {
            console.error(
                "❌ REAL MCP tools startup validation failed:",
                error
            );
            return {
                success: false,
                error: error.message,
                message: "REAL MCP tools startup validation failed with error",
            };
        }
    }

    /**
     * Quick validation check - just validates declarations without conversions
     * Use this for faster startup when full validation is not needed
     */
    async quickValidation(mcpToolMapper) {
        console.log("⚡ Running quick MCP validation...");

        try {
            const handlerDeclarations = mcpToolMapper.getHandlerDeclarations();

            if (handlerDeclarations.length === 0) {
                console.log("ℹ️  No MCP tools registered");
                return { success: true, message: "No MCP tools to validate" };
            }

            // Just validate Gemini API compliance
            this.validator.validateGeminiApiCompliance(handlerDeclarations);

            // Check mapping consistency
            const mappingIssues = mcpToolMapper.validateMappings();
            for (const issue of mappingIssues) {
                this.validator.addIssue("ERROR", issue);
            }

            const report = this.validator.generateReport();

            if (report.success) {
                console.log(
                    `✅ Quick MCP validation passed - ${handlerDeclarations.length} tools`
                );
            } else {
                console.warn(
                    `⚠️  Quick MCP validation found issues - ${report.summary.criticalCount} critical, ${report.summary.errorCount} errors`
                );
            }

            return {
                success: report.success,
                stats: { toolsValidated: handlerDeclarations.length },
                issues: report.issues,
                summary: report.summary,
            };
        } catch (error) {
            console.error("❌ Quick MCP validation failed:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Validate a single MCP server registration
     * Use this when adding MCP servers dynamically
     */
    async validateSingleServer(mcpToolMapper, serverName) {
        console.log(`🔍 Validating MCP server: ${serverName}`);

        try {
            const debugInfo = mcpToolMapper.getDebugInfo();
            const serverMappings = debugInfo.mappings.filter(
                (m) => m.server === serverName
            );

            if (serverMappings.length === 0) {
                console.log(`ℹ️  No tools found for server: ${serverName}`);
                return {
                    success: true,
                    message: `No tools found for server: ${serverName}`,
                };
            }

            // Get declarations for this server
            const allDeclarations = mcpToolMapper.getHandlerDeclarations();
            const serverDeclarations = allDeclarations.filter((d) =>
                serverMappings.some((m) => m.handler === d.name)
            );

            // Validate this server's declarations
            this.validator.validateGeminiApiCompliance(serverDeclarations);

            // Test conversions for this server using the main test method
            const tempValidator = new McpMappingValidator();
            await tempValidator.testOneToOneConversions(mcpToolMapper);

            // Merge issues from temp validator
            const tempReport = tempValidator.generateReport();
            for (const issue of tempReport.issues) {
                this.validator.addIssue(issue.severity, issue.message);
            }

            const report = this.validator.generateReport();

            if (report.success) {
                console.log(
                    `✅ Server ${serverName} validation passed - ${serverMappings.length} tools`
                );
            } else {
                console.warn(
                    `⚠️  Server ${serverName} validation found issues`
                );
            }

            return {
                success: report.success,
                serverName,
                toolCount: serverMappings.length,
                issues: report.issues,
                summary: report.summary,
            };
        } catch (error) {
            console.error(`❌ Server ${serverName} validation failed:`, error);
            return {
                success: false,
                serverName,
                error: error.message,
            };
        }
    }

    /**
     * Get validation statistics
     */
    getValidationStats() {
        return this.validator.stats;
    }

    /**
     * Get validation issues
     */
    getValidationIssues() {
        return this.validator.issues;
    }

    /**
     * Reset validator state
     */
    reset() {
        this.validator = new McpMappingValidator();
    }
}

module.exports = { StartupMcpValidator };
