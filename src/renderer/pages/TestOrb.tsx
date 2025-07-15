import React, { useState } from "react";
import AudioOrb from "../components/orb/AudioOrb";

interface TestOrbProps {
    goBack: () => void;
}

const TestOrb: React.FC<TestOrbProps> = ({goBack}) => {
    const [windowType, setWindowType] = useState("");
    return (
        <div className="flex flex-col justify-center items-center">
            <button onClick={goBack}>Back</button>
            <div className="h-10"></div>
            <div className="font-semibold">Test Orb</div>
            <p>This is a test page for the AudioOrb component.</p>
            <AudioOrb color="rgb(150, 50, 255)"/>
        </div>
    );
}
export default TestOrb;