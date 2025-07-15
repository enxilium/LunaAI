import React from "react";

interface SwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange }) => {
  return (
    <button
        onClick={() => onChange?.(!checked)}
        className={`w-[50px] h-[30px] rounded-full p-[5px] flex items-center transition-colors duration-300 ${
            checked ? "bg-[rgb(90,62,161)]" : "bg-[rgb(47,38,81)]"
        }`}
    >
    <div
        className={`w-5 h-5 rounded-full bg-gradient-to-b from-[rgb(124,100,196)] to-[rgb(209,191,253)] shadow-md transform transition-transform duration-300 ${
        checked ? "translate-x-5" : "translate-x-0"
        }`}
    />
</button>
    
  );
};

export default Switch;
