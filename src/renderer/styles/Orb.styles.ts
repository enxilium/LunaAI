import styled, { keyframes, css } from "styled-components";

// Adjust the fadeIn to match the pulse starting point
const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 0.8; transform: scale(0.95); }  /* Match pulse starting values */
`;

const pulse = keyframes`
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
`;

const processing = keyframes`
  0% { transform: scale(0.95); opacity: 0.7; box-shadow: 0 0 10px rgba(255, 165, 0, 0.7); }
  50% { transform: scale(1.05); opacity: 0.9; box-shadow: 0 0 20px rgba(255, 165, 0, 1); }
  100% { transform: scale(0.95); opacity: 0.7; box-shadow: 0 0 10px rgba(255, 165, 0, 0.7); }
`;

// New speaking animation with more subtle, faster pulses
const speaking = keyframes`
  0% { transform: scale(0.98); opacity: 0.85; box-shadow: 0 0 12px rgba(0, 191, 255, 0.8); }
  30% { transform: scale(1.03); opacity: 0.95; box-shadow: 0 0 18px rgba(0, 191, 255, 0.9); }
  60% { transform: scale(0.99); opacity: 0.9; box-shadow: 0 0 15px rgba(0, 191, 255, 0.85); }
  100% { transform: scale(0.98); opacity: 0.85; box-shadow: 0 0 12px rgba(0, 191, 255, 0.8); }
`;

const fadeOut = keyframes`
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.8); }
`;

export const OrbContainer = styled.div<{
    $listening: boolean;
    $visible: boolean;
    $processing?: boolean;
    $speaking?: boolean;
}>`
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: ${(p) => 
        p.$processing 
            ? 'radial-gradient(circle, #ffcc80 0%, #ff9800 100%)' 
            : p.$speaking 
                ? 'radial-gradient(circle, #80d8ff 0%, #0091ea 100%)'
                : `radial-gradient(circle, ${p.theme.orb.primary} 0%, ${p.theme.orb.secondary} 100%)`
    };
    cursor: grab;
    transition: background 0.5s ease;

    /* Fix animation syntax for styled-components v4+ */
    ${(p) =>
        p.$visible
            ? p.$listening && !p.$processing && !p.$speaking
                ? css`
                      animation: ${fadeIn} 0.5s ease forwards,
                          ${pulse} 2s infinite 0.5s;
                  `
                : p.$processing
                ? css`
                      animation: ${fadeIn} 0.5s ease forwards,
                          ${processing} 1.5s infinite 0.5s;
                  `
                : p.$speaking
                ? css`
                      animation: ${fadeIn} 0.5s ease forwards,
                          ${speaking} 1.2s infinite 0.2s;
                  `
                : css`
                      animation: ${fadeIn} 0.5s ease forwards;
                  `
            : css`
                  animation: ${fadeOut} 0.8s ease forwards;
              `}

    opacity: ${(p) => (p.$listening ? 1 : p.$processing ? 0.9 : p.$speaking ? 0.95 : 0.7)};
    box-shadow: 0 0 20px
        ${(p) => 
            p.$listening 
                ? p.theme.orb.glow 
                : p.$processing 
                    ? "rgba(255, 165, 0, 0.7)" 
                    : p.$speaking
                        ? "rgba(0, 191, 255, 0.7)"
                        : "transparent"
        };
    -webkit-app-region: drag;
    -webkit-user-select: none;
    
    &:hover {
        cursor: grab !important;
    }

    &:active,
    &:active:hover {
        cursor: grabbing !important;
    }
`;

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
    display: ${p => p.$active ? 'flex' : 'none'};
    align-items: center;
    justify-content: space-between;
`;

export const AudioBar = styled.div<{
    $height: number;
}>`
    width: 2px;
    height: ${p => p.$height}%;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 1px;
`;
