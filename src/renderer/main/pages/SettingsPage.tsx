import React, { useEffect, useState } from "react";
import { BinarySetting } from "../components/main/settingsComponents";

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
    const [settings, setSettings] = useState({});

    async function fetchSettings() {
        const newSettings = await window.electron.getAllSettings();
        setSettings(newSettings);
    }

    async function updateSetting(name: string, value: any) {
        await window.electron.updateSetting(name, value);
    }

    useEffect(() => {
        fetchSettings();
    }, []);
    // TODO: Voice settings; language settings.
    return (
        <div className="bg-stone-950 min-h-screen text-white p-8">
            <h1 className="text-3xl font-bold mb-8">Settings</h1>

            <h2 className="text-2xl font-semibold mt-8 mb-4">Preferences</h2>
            <div className="grid grid-cols-1 gap-6">
                {PREFERENCES.map((pref) => (
                    <div key={pref.name}>
                        <BinarySetting
                            title={pref.title}
                            description={pref.description}
                            value={settings[pref.name as keyof typeof settings]}
                            onChange={(value: boolean) =>
                                updateSetting(pref.name, value)
                            }
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SettingsPage;
