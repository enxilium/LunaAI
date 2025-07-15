import React, { useEffect, useState } from "react";
import AudioOrb from "../components/orb/AudioOrb";
import { useAssets } from "../hooks/useAssets";
import { PreferencesCard } from "../components/main/PreferencesCard";
import { BinarySetting } from "../components/main/settingsComponents";
import Switch from "../components/main/Switch";

interface ConfigurationProps {
    goBack: () => void;
}

const Configuration: React.FC<ConfigurationProps> = ({ goBack }) => {
    const [enabled, setEnabled] = useState(false);
    const [windowType, setWindowType] = useState("");
    
    return (
        <div className="grid grid-cols-[1fr_3fr] h-screen w-full bg-backgroundColor font-fontUrl">
            <div className="flex-flex-col bg-backgroundColor2 h-full w-full p-8 border border-borderColor">
                {/* Sidebar content can go here, such as navigation links or settings categories */}
                <button onClick={goBack} className="text-white">Back</button>
                <h2 className="text-xl text-accent my-4">Configuration</h2>
            </div>
            <div className="flex-flex-col p-8 gap-16">
                {/* Cards and options here */}
                <h2 className="text-xl text-accent my-4">General</h2>
                <PreferencesCard
                    header="General Settings"
                    description="Configure general application settings."
                    onClick={() => console.log("General Settings Clicked")}
                >
                    <Switch checked={enabled} onChange={setEnabled} />
                </PreferencesCard>
                <PreferencesCard
                    header="Biyoo Mu"
                    description="My cute shiwu."
                    onClick={() => console.log("General Settings Clicked")}
                />
                <PreferencesCard
                    header="I love shiwu"
                    description="I am gonna touch u"
                    onClick={() => console.log("General Settings Clicked")}
                />
            </div>
        </div>
);
};

export default Configuration;
