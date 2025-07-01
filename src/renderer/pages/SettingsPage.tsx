import React, { useEffect, useState } from "react";
import { FaSpotify, FaDiscord, FaGoogle } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { RiNotionFill } from "react-icons/ri";
import { Integration, BinarySetting } from "../components/settingsComponents";

const INTEGRATIONS = [
    {
        name: "spotify",
        icon: FaSpotify,
    },
    {
        name: "google",
        icon: FcGoogle,
    },
    {
        name: "discord",
        icon: FaDiscord,
    },
    {
        name: "notion",
        icon: RiNotionFill,
    },
];

const PREFERENCES = [
    {
        name: "clippingEnabled",
        title: "Enable Clipping",
        description: "Allow clipping of content from your screen.",
    },
    {
        name: "runOnStartup",
        title: "Run on Startup",
        description: "Start the application automatically when you log in.",
    },
    {
        name: "startMinimized",
        title: "Start Minimized",
        description: "Launch the application in a minimized state.",
    },
    {
        name: "automaticallyCheckForUpdates",
        title: "Automatically Check for Updates",
        description: "Check for application updates automatically.",
    },
    {
        name: "learningMode",
        title: "Learning Mode (Experimental)",
        description:
            "Enable learning mode for personalized content. NOTE: This feature involves saving your user data. See our privacy policy for more information.",
    },
];

const SettingsPage: React.FC = () => {
    const [settings, setSettings] = useState({
        spotifyAuth: false,
        googleAuth: false,
        discordAuth: false,
        notionAuth: false,
        // TODO: Fill in other settings.
    });

    async function fetchSettings() {
        const newSettings = await window.electron.getAsset("allSettings");
        console.log("Fetched settings:", newSettings);
        setSettings(newSettings);
    }

    async function updateSettings(name: string, value: any) {
        await window.electron.invoke("update-settings", name, value);
        fetchSettings();
    }

    useEffect(() => {
        fetchSettings();
    }, []);
// TODO: Voice settings; language settings.
    return (
        <div className="bg-stone-950 min-h-screen text-white p-8">
            <h1 className="text-3xl font-bold mb-8">Settings</h1>

            <h2 className="text-2xl font-semibold mb-4">Connected Services</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {INTEGRATIONS.map((integration) => (
                    <div key={integration.name}>
                        <Integration
                            name={integration.name}
                            icon={integration.icon}
                            isConnected={
                                settings[
                                    (integration.name +
                                        "Auth") as keyof typeof settings
                                ]
                            }
                        />
                    </div>
                ))}
            </div>

            <h2 className="text-2xl font-semibold mt-8 mb-4">Preferences</h2>
            <div className="grid grid-cols-1 gap-6">
                {PREFERENCES.map((pref) => (
                    <div key={pref.name}>
                        <BinarySetting
                            title={pref.title}
                            description={pref.description}
                            value={settings[pref.name as keyof typeof settings]}
                            onChange={(value: boolean) =>
                                updateSettings(pref.name, value)
                            }
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SettingsPage;
