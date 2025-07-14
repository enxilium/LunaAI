import React, { useState, useEffect } from "react";

interface CardProps {
    header: string;
    description: string;
    children?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: "primary" | "secondary";
}

const PreferencesCard: React.FC<CardProps> = ({header, description, children, onClick, disabled, loading, variant}) => {
    return (
        <div className="relative p-[1px] rounded-[13px] bg-gradient-to-br from-[hsl(243,19%,37%)] via-[rgb(52,40,85)] to-[rgb(68,35,123)] my-4">
            <div className="flex flex-row bg-backgroundColor2 p-3 rounded-[12px] shadow-md">   
                <div className="flex flex-col w-full justify-center items-start gap-1">
                    <div className="text-sm text-semibold text-accent">
                        {header}
                    </div>
                    <div className="text-xs text-textColor">
                        {description}
                    </div>
                </div>
                <div className="flex flex-row w-full items-center justify-end">
                    {children}
                </div>
            </div>
        </div>
    )
}

export { PreferencesCard };