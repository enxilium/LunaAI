import React, { useEffect, useState } from "react";
import { IconType } from "react-icons";

interface settingProps {
    title: string;
    description: string;
    value: boolean;
    onChange: (value: boolean) => void;
}

const BinarySetting: React.FC<settingProps> = ({
    title,
    description,
    value,
    onChange,
}) => {
    return (
        <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg mb-4">
            <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-gray-400">{description}</p>
            </div>
            <label className="inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                    className="form-checkbox h-5 w-5 text-indigo-600 transition duration-150 ease-in-out"
                />
            </label>
        </div>
    );
};

export { BinarySetting };
