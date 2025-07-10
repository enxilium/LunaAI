import styled, { keyframes, css } from "styled-components";

// Add a new component for audio visualization inside the orb (optional)
export const AudioWaves = styled.div<{
    $active: boolean;
}>`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 70%;
    height: 30%;
    display: ${(p) => (p.$active ? "flex" : "none")};
    align-items: center;
    justify-content: space-between;
`;

export const AudioBar = styled.div<{
    $height: number;
}>`
    width: 2px;
    height: ${(p) => p.$height}%;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 1px;
`;
