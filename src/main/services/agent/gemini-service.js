const {
    GoogleGenAI,
    Modality,
    FunctionResponseScheduling,
    mcpToTool,
} = require("@google/genai");
const { ipcMain } = require("electron");
const { getEventsService } = require("../events-service");
const {
    getSystemInstruction,
    getSpeechConfig,
} = require("../../invokes/get-asset");
const { getCredentialsService } = require("../user/credentials-service");
const { getMcpService } = require("./mcp-service");

let geminiService = null;

// Define internal tools that need access to the main process
const internalTools = {
    handleEnd: {
        functionDeclarations: [
            {
                name: "handleEnd",
                description:
                    "Handles the end of a conversation. Should be called after confirming with the user that they have no more requests.",
            },
        ],
    },
};

class GeminiService {
    constructor() {
        this.session = null;
        this.client = null;
        this.eventsService = null;
        this.mcpService = null;
        this.mcpTool = null;
    }

    async initialize() {
        this.eventsService = await getEventsService();
        this.mcpService = await getMcpService();

        const apiKey = await getCredentialsService().getCredentials(
            "gemini-key"
        );
        const systemInstruction = await getSystemInstruction();

        if (!apiKey || !systemInstruction) {
            console.error("Gemini Service: Missing initialization parameters.");
            return;
        }

        const mcpClients = await this.mcpService.getAllClients();
        if (mcpClients.length > 0) {
            this.mcpTool = mcpToTool(...mcpClients);
        }

        this.client = new GoogleGenAI({ apiKey });

        ipcMain.handle("gemini:start-session", () =>
            this.startSession(systemInstruction)
        );

        ipcMain.on("gemini:audio-data", (event, audioData) =>
            this.sendAudioData(audioData)
        );

        ipcMain.handle("gemini:close-session", () => this.closeSession());
    }

    async startSession(systemInstruction) {
        const speechConfig = await getSpeechConfig();

        if (this.session) {
            console.log("Gemini Service: Session already active.");
            return { success: true };
        }

        try {
            console.log("Gemini Service: Starting session...");

            const externalTools = this.mcpTool ? [this.mcpTool] : [];
            const allTools = [...externalTools, internalTools.handleEnd];

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
                        console.log(
                            "Gemini Service: Session closed:",
                            e.reason
                        );
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
                    systemInstruction: systemInstruction,
                    speechConfig: speechConfig,
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
            const externalToolCalls = [];

            for (const call of message.toolCall.functionCalls) {
                if (internalTools[call.name]) {
                    internalToolCalls.push(call);
                } else {
                    externalToolCalls.push(call);
                }
            }

            const functionResponses = [];

            // Handle internal tools
            for (const call of internalToolCalls) {
                if (call.name === "handleEnd") {
                    const result =
                        await this.eventsService.handleConversationEnd();
                    functionResponses.push({
                        id: call.id,
                        name: call.name,
                        response: result,
                    });
                }
            }

            // Handle external tools via MCP
            if (externalToolCalls.length > 0) {
                if (!this.mcpTool) {
                    console.error(
                        "Gemini Service: Received external tool call but no MCP tool is configured."
                    );
                    // Handle error case, maybe send a response back to Gemini
                } else {
                    try {
                        const mcpResponses = await this.mcpTool.callTool(
                            externalToolCalls
                        );

                        const externalFunctionResponses = mcpResponses.map(
                            (part, index) => {
                                const originalCall = externalToolCalls[index];
                                return {
                                    id: originalCall.id,
                                    name: originalCall.name,
                                    response: part.functionResponse.response,
                                };
                            }
                        );
                        functionResponses.push(...externalFunctionResponses);
                    } catch (e) {
                        console.error(
                            "Gemini Service: Error calling external tool:",
                            e
                        );
                    }
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
