import React, { useEffect, useState } from "react";
import { IconType } from "react-icons";

interface IntegrationProps {
    name: string;
    icon: IconType;
    isConnected: boolean;
}

const Integration: React.FC<IntegrationProps> = ({name, icon, isConnected}) => {
    const [auth, setAuth] = useState(isConnected);
    const [loading, setLoading] = useState(false);

    function handleAuth() {
        console.log(`Authenticating ${name}`);

        return async () => {
            try {
                setLoading(true);

                await window.electron.invoke('authorize-service', name)
                .then(result => {if (result) {setAuth(true)}})

                console.log(`${name} authorization successful`);
            } catch (error) {
                window.electron?.invoke('error', `Error authorizing ${name}: ${error}`);
            } finally {
                setLoading(false);
            }
        }
    }

    async function handleDisconnect(service: string) {
        console.log(`Disconnecting ${service}`);

        try {
            await window.electron.invoke('disconnect-service', service)
            .then(result => {if (result) {setAuth(false)}})

            console.log(`${service} disconnected successfully`);
        } catch (error) {
            window.electron?.invoke('error', `Error authorizing ${name}: ${error}`);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        setAuth(isConnected);
    }, [isConnected]);

    return (
        <div className="bg-stone-800 rounded-lg p-6">
            <div className="flex items-start justify-between">
                <div className="flex items-center">
                    <div className="bg-indigo-900 p-3 rounded-lg mr-4">
                        {React.createElement(icon, { className: "h-6 w-6 text-indigo-400" })}
                    </div>
                    <div>
                        <h3 className="text-xl font-medium">{name}</h3>
                        <p className="text-stone-400 mt-1">
                            Connected: {auth ? 'Yes' : 'No'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={auth ? () => handleDisconnect(name) : handleAuth()}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        auth
                            ? "bg-red-900 text-red-200 hover:bg-red-800"
                            : "bg-indigo-900 text-indigo-200 hover:bg-indigo-800"
                    }`}
                >
                    {loading
                        ? "..."
                        : auth
                        ? "Disconnect"
                        : "Connect"}
                </button>
            </div>
        </div>
    );
}

export default Integration;

