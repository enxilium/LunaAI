import { useState, useRef, useCallback, useEffect } from "react";
import {
    GoogleGenAI,
    Modality,
    Session,
    LiveServerMessage,
    FunctionResponse,
    LiveServerContent,
    FunctionCall,
    FunctionResponseScheduling,
} from "@google/genai";
import useAudio from "./useAudio";
import useError from "./useError";

/**
 * @description Custom hook for managing the Gemini session.
 * @param {string | null} apiKey - The Gemini API key.
 * @returns {{
 *  session: Session | null;
 *  startSession: (onMessage: (message: LiveServerMessage) => void) => Promise<Session | null>;
 *  closeSession: () => void;
 *  sendToolResponse: (functionResponses: FunctionResponse[]) => void;
 *  isSpeaking: boolean;
 *  isInterrupted: boolean;
 * }}
 */
export default function useGemini(apiKey: string | null) {
    const [session, setSession] = useState<Session | null>(null);
    const sessionRef = useRef<Session | null>(null);
    const [isInterrupted, setIsInterrupted] = useState(false);
    const [tools, setTools] = useState<any[]>([]);
    const clientRef = useRef<GoogleGenAI | null>(null);

    const { playAudio, isPlaying: isSpeaking, stopAudio } = useAudio();
    const { reportError } = useError();

    const SYSTEM_INSTRUCTION =
        "You are a capable and helpful desktop assistant named Luna.";

    useEffect(() => {
        try {
            window.electron.getAsset("tools").then((tools: any[]) => {
                setTools(tools);
            });
        } catch (e: any) {
            reportError(`Failed to get tools: ${e.message}`, "useGemini");
        }
    }, [reportError]);

    const sendToolResponse = useCallback(
        (functionResponses: FunctionResponse[]) => {
            if (sessionRef.current) {
                console.log(
                    "Sending function responses to Gemini:",
                    functionResponses
                );

                sessionRef.current.sendToolResponse({
                    functionResponses: functionResponses,
                });
            }
        },
        []
    );

    const handleGeminiMessage = useCallback(
        async (message: any) => {
            if (message.toolCall) {
                const { functionCalls } = message.toolCall;

                const promises = functionCalls.map(
                    async (functionCall: FunctionCall) => {
                        const result = await window.electron.invoke(
                            "execute-command",
                            {
                                name: functionCall.name,
                                args: functionCall.args,
                            }
                        );

                        console.log("Result:", result);

                        return {
                            id: functionCall.id,
                            name: functionCall.name,
                            response: {
                                result: result,
                                scheduling:
                                    FunctionResponseScheduling.WHEN_IDLE,
                            },
                        };
                    }
                );

                const functionResponses = (await Promise.all(
                    promises
                )) as FunctionResponse[];

                sendToolResponse(functionResponses);
            } else {
                const audio =
                    message.serverContent?.modelTurn?.parts?.[0]?.inlineData;
                if (audio?.data) {
                    console.log("Received audio chunk from Gemini.");
                    await playAudio(audio.data);
                }
            }
        },
        [playAudio, sendToolResponse]
    );

    const startSession = useCallback(async () => {
        if (!apiKey) {
            reportError("Gemini API key not available.", "useGemini");
        }

        if (!clientRef.current) {
            clientRef.current = new GoogleGenAI({ apiKey: apiKey || "" });
        }

        try {
            const newSession = await clientRef.current.live.connect({
                model: "gemini-live-2.5-flash-preview",
                callbacks: {
                    onopen: () => {
                        console.log("Gemini session opened.");
                        setIsInterrupted(false);
                    },
                    onmessage: (message: LiveServerMessage) => {
                        const serverContent =
                            message.serverContent as LiveServerContent;
                        if (serverContent?.interrupted) {
                            console.log("Gemini session interrupted.");
                            setIsInterrupted(true);
                            stopAudio();
                        } else {
                            handleGeminiMessage(message);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error("Gemini session error:", e.message);
                    },
                    onclose: (e: CloseEvent) => {
                        console.log("Gemini session closed:", e.reason);
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: SYSTEM_INSTRUCTION,
                    tools: tools,
                },
            });
            setSession(newSession);
            sessionRef.current = newSession;
            return newSession;
        } catch (e: any) {
            reportError(
                `Failed to connect to Gemini Live API: ${e}`,
                "useGemini"
            );
            return null;
        }
    }, [apiKey, tools, handleGeminiMessage, stopAudio, reportError]);

    const closeSession = useCallback(() => {
        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
            setSession(null);
        }
    }, []);

    return {
        session,
        startSession,
        closeSession,
        sendToolResponse,
        isSpeaking,
        isInterrupted,
    };
}
