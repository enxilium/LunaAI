const {
    GoogleGenAI,
    Modality,
    FunctionResponseScheduling,
} = require("@google/genai");
const { ipcMain } = require("electron");
const { executeCommand } = require("../../invokes/execute-command");
const { getEventsService } = require("../events-service");
const {
    getTools,
    getSystemInstruction,
    getSpeechConfig,
} = require("../../invokes/get-asset");
const { getCredentialsService } = require("../user/credentials-service");

let geminiService = null;

class GeminiService {
    constructor() {
        this.session = null;
        this.client = null;
        this.eventsService = null;
    }

    async initialize() {
        this.eventsService = await getEventsService();

        const apiKey = await getCredentialsService().getCredentials(
            "gemini-key"
        );
        const tools = await getTools();
        const systemInstruction = await getSystemInstruction();

        if (!apiKey || !tools || !systemInstruction) {
            console.error("Gemini Service: Missing initialization parameters.");
            return;
        }

        this.client = new GoogleGenAI({ apiKey });

        ipcMain.handle("gemini:start-session", () =>
            this.startSession(tools, systemInstruction)
        );

        ipcMain.on("gemini:audio-data", (event, audioData) =>
            this.sendAudioData(audioData)
        );

        ipcMain.handle("gemini:close-session", () => this.closeSession());
    }

    async startSession(tools, systemInstruction) {
        const speechConfig = await getSpeechConfig();

        if (this.session) {
            console.log("Gemini Service: Session already active.");
            return { success: true };
        }

        try {
            console.log("Gemini Service: Starting session...");
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
                    tools: tools,
                    speechConfig: speechConfig,
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
            const { functionCalls } = message.toolCall;
            console.log("Gemini Service: Received tool call:", functionCalls);

            const promises = functionCalls.map(async (functionCall) => {
                const result = await executeCommand({
                    name: functionCall.name,
                    args: functionCall.args,
                });
                return {
                    id: functionCall.id,
                    name: functionCall.name,
                    response: {
                        result: result,
                        scheduling: FunctionResponseScheduling.WHEN_IDLE,
                    },
                };
            });

            const functionResponses = await Promise.all(promises);
            if (this.session) {
                console.log(
                    "Gemini Service: Sending tool responses:",
                    functionResponses
                );
                this.session.sendToolResponse({ functionResponses });
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
