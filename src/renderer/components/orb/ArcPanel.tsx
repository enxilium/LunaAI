import React from "react";
import styled from "styled-components";

const ArcPanelWrapper = styled.div<{
    $visible: boolean;
    $side: "left" | "right";
    $panelCollapsed: boolean;
}>`
    position: absolute;
    top: 50%;
    ${(props) => (props.$side === "left" ? "left: 120px;" : "right: 120px;")}
    transform: translateY(-50%);
    width: ${(props) => (props.$panelCollapsed ? "40px" : "200px")};
    height: ${(props) => (props.$panelCollapsed ? "40px" : "160px")};
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: ${(props) => (props.$panelCollapsed ? "20px" : "80px")};
    display: flex;
    flex-direction: ${(props) => (props.$panelCollapsed ? "row" : "column")};
    align-items: center;
    justify-content: center;
    gap: ${(props) => (props.$panelCollapsed ? "0" : "15px")};
    padding: ${(props) => (props.$panelCollapsed ? "8px" : "20px")};
    opacity: ${(props) => (props.$visible ? 1 : 0)};
    pointer-events: ${(props) => (props.$visible ? "auto" : "none")};
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
`;

const PanelButton = styled.button<{ $collapsed: boolean }>`
    background: transparent;
    border: none;
    cursor: pointer;
    padding: ${(props) => (props.$collapsed ? "6px" : "12px")};
    border-radius: 50%;
    font-size: ${(props) => (props.$collapsed ? "16px" : "20px")};
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${(props) => (props.$collapsed ? "24px" : "40px")};
    height: ${(props) => (props.$collapsed ? "24px" : "40px")};

    &:hover {
        background: rgba(0, 0, 0, 0.1);
        transform: scale(1.1);
    }

    &:active {
        transform: scale(0.95);
    }
`;

const ToggleButton = styled.button<{ $side: "left" | "right" }>`
    position: absolute;
    top: 50%;
    ${(props) => (props.$side === "left" ? "right: -15px;" : "left: -15px;")}
    transform: translateY(-50%);
    width: 30px;
    height: 60px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;

    &:hover {
        background: rgba(255, 255, 255, 1);
        transform: translateY(-50%) scale(1.05);
    }

    &:active {
        transform: translateY(-50%) scale(0.95);
    }
`;

interface PanelAction {
    icon: string;
    label: string;
    action: () => void;
}

interface ArcPanelProps {
    visible: boolean;
    side: "left" | "right";
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    actions: PanelAction[];
}

const ArcPanel: React.FC<ArcPanelProps> = ({
    visible,
    side,
    collapsed,
    setCollapsed,
    actions,
}) => {
    return (
        <ArcPanelWrapper
            $visible={visible}
            $side={side}
            $panelCollapsed={collapsed}
        >
            {!collapsed && (
                <ToggleButton
                    $side={side}
                    onClick={() => setCollapsed(true)}
                >
                    {side === "left" ? "◀" : "▶"}
                </ToggleButton>
            )}

            {collapsed ? (
                <PanelButton
                    $collapsed={true}
                    onClick={() => setCollapsed(false)}
                    title="Expand controls"
                >
                    ⚙️
                </PanelButton>
            ) : (
                actions.map((action, index) => (
                    <PanelButton
                        key={index}
                        $collapsed={false}
                        onClick={action.action}
                        title={action.label}
                    >
                        {action.icon}
                    </PanelButton>
                ))
            )}
        </ArcPanelWrapper>
    );
};

export default ArcPanel;
