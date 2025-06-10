import React, { useEffect, useState } from "react";
import { FiMusic, FiSlack, FiGithub, FiCalendar } from "react-icons/fi";
import { IconType } from "react-icons";

// Cast the icons to IconType
const MusicIcon: IconType = FiMusic as IconType;
const SlackIcon: IconType = FiSlack as IconType;
const GithubIcon: IconType = FiGithub as IconType;
const CalendarIcon: IconType = FiCalendar as IconType;

const SettingsPage: React.FC = () => {
    const [spotifyAuth, setSpotifyAuth] = useState(false);
    const [spotifyLoading, setSpotifyLoading] = useState(false);

    async function fetchSettings() {
        if (window.electron) {
            try {
                const settings = await window.electron.invoke('get-settings');
                console.log("Settings:", settings);
                if (Array.isArray(settings)) {
                    for (const setting of settings) {
                        const { field, value } = setting;
                        fillSetting(field, value);
                    }
                } else {
                    const { field, value } = settings;
                    fillSetting(field, value);
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            }
        }
    }

    function handleAuth(service: string) {
        return async () => {
            if (!spotifyAuth) {
                console.log(`Requesting authorization for ${service}`);
                if (window.electron) {
                    try {
                        setSpotifyLoading(true);
                        await window.electron.invoke('authorize-service', service)
                        .then(result => {
                            if (result && result.field) {
                                fillSetting(result.field, result.value);
                            }
                        })
                    } catch (error) {
                        console.error(`Error authorizing ${service}:`, error);
                    } finally {
                        setSpotifyLoading(false);
                    }
                }
            }
            else {
                handleDisconnect(service);
                return
            }
        }
    }

    async function handleDisconnect(service: string) {
        console.log(`Disconnecting ${service}`);
        if (window.electron) {
            try {
                await window.electron.invoke('disconnect-service', service)
                .then(result => {
                if (result && result.field) {
                    fillSetting(result.field, result.value);
                }})
            } catch (error) {
                console.error(`Error disconnecting ${service}:`, error);
            } finally {
                setSpotifyLoading(false);
            }
        }
    }

    function fillSetting(setting: string, value: any) {
        console.log(`Setting ${setting} to ${value}`);
        switch (setting) {
            case "spotifyAuthorized":
                setSpotifyAuth(value);
                break;
            default:
                console.error(`Unknown setting: ${setting}`);
        }
    }

    useEffect(() => {
        fetchSettings();
    }, []);

    const cards = [
        {
            id: "spotify",
            name: "Spotify",
            description: "Connect to your Spotify account for music control.",
            icon: MusicIcon,
            isConnected: spotifyAuth,
            isLoading: spotifyLoading,
            onConnect: handleAuth("spotify")
        },
        {
            id: "slack",
            name: "Slack",
            description: "Connect to Slack for messaging and notifications.",
            icon: SlackIcon,
            isConnected: false,
            onConnect: handleAuth("slack")
        },
        {
            id: "github",
            name: "GitHub",
            description: "Connect to GitHub for code and repository management.",
            icon: GithubIcon,
            isConnected: false,
            onConnect: handleAuth("github")
        },
        {
            id: "calendar",
            name: "Calendar",
            description: "Connect to your calendar for scheduling and events.",
            icon: CalendarIcon,
            isConnected: false,
            onConnect: handleAuth("calendar")
        }
    ];

    return (
        <div className="bg-stone-950 min-h-screen text-white p-8">
            <h1 className="text-3xl font-bold mb-8">Settings</h1>
            
            <h2 className="text-2xl font-semibold mb-4">Connected Services</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {cards.map((card) => (
                    <div key={card.id} className="bg-stone-800 rounded-lg p-6">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center">
                                <div className="bg-indigo-900 p-3 rounded-lg mr-4">
                                    <card.icon className="h-6 w-6 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-medium">{card.name}</h3>
                                    <p className="text-stone-400 mt-1">{card.description}</p>
                                </div>
                            </div>
                            <button
                                onClick={card.onConnect}
                                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                    card.isConnected
                                        ? "bg-red-900 text-red-200 hover:bg-red-800"
                                        : "bg-indigo-900 text-indigo-200 hover:bg-indigo-800"
                                }`}
                            >
                                {card.isLoading ? "..." : card.isConnected ? "Disconnect" : "Connect"}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SettingsPage;
