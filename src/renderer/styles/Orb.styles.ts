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
  0% { transform: scale(0.95); opacity: 0.7; box-shadow: 0 0 5px rgba(255, 165, 0, 0.7); }
  50% { transform: scale(1.05); opacity: 0.9; box-shadow: 0 0 15px rgba(255, 165, 0, 1); }
  100% { transform: scale(0.95); opacity: 0.7; box-shadow: 0 0 5px rgba(255, 165, 0, 0.7); }
`;

const fadeOut = keyframes`
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.8); }
`;

export const OrbContainer = styled.div<{
    $listening: boolean;
    $visible: boolean;
    $processing?: boolean;
}>`
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: radial-gradient(
        circle,
        ${(p) => p.theme.orb.primary} 0%,
        ${(p) => p.theme.orb.secondary} 100%
    );
    cursor: grab;
    transition: all 0.3s ease;

    /* Fix animation syntax for styled-components v4+ */
    ${(p) =>
        p.$visible
            ? p.$listening
                ? css`
                      animation: ${fadeIn} 0.5s ease forwards,
                          ${pulse} 2s infinite 0.5s;
                  `
                : p.$processing
                ? css`
                      animation: ${fadeIn} 0.5s ease forwards,
                          ${processing} 1.5s infinite 0.5s;
                      background: radial-gradient(
                          circle,
                          ${p.theme.orb.primary} 0%,
                          orange 100%
                      );
                  `
                : css`
                      animation: ${fadeIn} 0.5s ease forwards;
                  `
            : css`
                  animation: ${fadeOut} 0.8s ease forwards;
              `}

    opacity: ${(p) => (p.$listening ? 1 : p.$processing ? 0.9 : 0.7)};
    box-shadow: 0 0 20px
        ${(p) => 
            p.$listening 
                ? p.theme.orb.glow 
                : p.$processing 
                    ? "rgba(255, 165, 0, 0.7)" 
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
