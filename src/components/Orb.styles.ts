import styled, { keyframes } from "styled-components";

const pulse = keyframes`
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
`;

export const OrbContainer = styled.div<{ $listening: boolean }>`
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: radial-gradient(
        circle,
        ${(p) => p.theme.orb.primary} 0%,
        ${(p) => p.theme.orb.secondary} 100%
    );
    cursor: grab; // This is already correct
    transition: all 0.3s ease;
    animation: ${pulse} 2s infinite;
    opacity: ${(p) => (p.$listening ? 1 : 0.7)};
    box-shadow: 0 0 20px
        ${(p) => (p.$listening ? p.theme.orb.glow : "transparent")};
    -webkit-app-region: drag; // Make the orb draggable
    -webkit-user-select: none; // Prevent text selection during drag

    &,
    &:hover {
        cursor: grab !important;
    }

    &:active,
    &:active:hover {
        cursor: grabbing !important;
    }
`;
