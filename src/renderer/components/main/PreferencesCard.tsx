import React, { useState, useEffect } from "react";

interface CardProps {
    header: string;
    description: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: "primary" | "secondary";
}

const PreferencesCard: React.FC<CardProps> = ({header, description, onClick, disabled, loading, variant}) => {
    return (
        <div className="relative p-[2px] rounded-[18px] bg-gradient-to-b from-[rgb(128,126,181)] via-[rgb(48,28,94)] to-[rgb(84,53,154)] my-4">
            <div className="flex flex-row bg-backgroundColor2 p-4 rounded-2xl shadow-md">   
                <div className="flex flex-col w-full justify-center items-start gap-2">
                    <div className="text-lg text-semibold text-accent">
                        {header}
                    </div>
                    <div className="text-sm text-textColor">
                        {description}
                    </div>
                </div>
                <div className="flex flex-row w-full items-center justify-end">hi</div>
            </div>
        </div>
    )
}

export { PreferencesCard };