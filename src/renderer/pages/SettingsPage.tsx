import React, { useEffect, useState } from "react";
import { FaSpotify, FaDiscord, FaGoogle } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { RiNotionFill } from "react-icons/ri";
import Integration from "../components/Integration";

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
    }
]


const SettingsPage: React.FC = () => {
    const [settings, setSettings] = useState({
        spotifyAuth: false,
        googleAuth: false,
        discordAuth: false,
        notionAuth: false,
        // TODO: Fill in other settings.
    });

    async function fetchSettings() {
        const newSettings = await window.electron.invoke('get-settings');
        console.log('Fetched settings:', newSettings);
        setSettings(newSettings);
    }

    useEffect(() => {
        fetchSettings();
    }, []);

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
                            isConnected={settings[integration.name + 'Auth' as keyof typeof settings]}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SettingsPage;
