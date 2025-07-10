import React, { useState, useEffect } from "react";

interface ButtonProps {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: "primary" | "secondary";
}

const Button: React.FC<ButtonProps> = ({label, onClick, disabled, loading, variant}) => {

    return (
        <div className={disabled? "bg-gray-500 text-white p-2 rounded cursor-not-allowed" : "bg-blue-500 text-white p-2 rounded cursor-pointer"}>
            <button onClick={onClick}>

            </button>
        </div>
    )
}

export { Button };