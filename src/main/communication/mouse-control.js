const robot = require("robotjs");

// Set robot speed and delay for smoother movements
robot.setMouseDelay(2);

/**
 * Sleep function for delays between movements
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cubic ease-out function for smooth movement
 * @param {number} t - Progress (0 to 1)
 * @returns {number} - Eased value
 */
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Smooth mouse movement with human-like behavior
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Target X coordinate
 * @param {number} endY - Target Y coordinate
 * @param {number} duration - Duration in milliseconds
 */
async function smoothMouseMove(startX, startY, endX, endY, duration = 300) {
    const steps = Math.max(10, Math.floor(duration / 16)); // ~60fps
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const easedProgress = easeOutCubic(progress);

        const currentX = Math.round(startX + deltaX * easedProgress);
        const currentY = Math.round(startY + deltaY * easedProgress);

        robot.moveMouse(currentX, currentY);

        if (i < steps) {
            await sleep(16); // ~60fps
        }
    }
}

/**
 * Control mouse actions with smooth movements
 * @param {Object} params - Mouse control parameters
 * @param {string} params.action - Action type: "click", "move", "scroll", "drag"
 * @param {number} params.x - X coordinate
 * @param {number} params.y - Y coordinate
 * @param {string} params.button - Mouse button: "left", "right", "middle"
 * @param {string} params.scroll_direction - Scroll direction: "up", "down"
 * @param {number} params.scroll_amount - Number of scroll steps (default: 3)
 * @returns {Promise<Object>} - Result of the mouse action
 */
async function controlMouse(params) {
    try {
        const {
            action,
            x,
            y,
            button = "left",
            scroll_direction = "up",
            scroll_amount = 3,
            reasoning = "",
        } = params;

        console.log(
            `Mouse control action: ${action} at (${x}, ${y}) with button: ${button}. Reason: ${reasoning}`
        );

        // Get current mouse position for smooth movement
        const currentPos = robot.getMousePos();

        switch (action.toLowerCase()) {
            case "move":
                if (x !== undefined && y !== undefined) {
                    await smoothMouseMove(
                        currentPos.x,
                        currentPos.y,
                        x,
                        y,
                        200
                    );
                    return {
                        success: true,
                        message: `Mouse moved to (${x}, ${y})`,
                        action: "move",
                        coordinates: { x, y },
                    };
                }
                break;

            case "click":
                if (x !== undefined && y !== undefined) {
                    // Move to position smoothly first
                    await smoothMouseMove(
                        currentPos.x,
                        currentPos.y,
                        x,
                        y,
                        200
                    );
                    await sleep(50); // Brief pause before clicking

                    robot.mouseClick(button);

                    return {
                        success: true,
                        message: `${button} clicked at (${x}, ${y})`,
                        action: "click",
                        coordinates: { x, y },
                        button,
                    };
                }
                break;

            case "doubleclick":
                if (x !== undefined && y !== undefined) {
                    await smoothMouseMove(
                        currentPos.x,
                        currentPos.y,
                        x,
                        y,
                        200
                    );
                    await sleep(50);

                    robot.mouseClick(button);
                    await sleep(100);
                    robot.mouseClick(button);

                    return {
                        success: true,
                        message: `Double-clicked at (${x}, ${y})`,
                        action: "doubleclick",
                        coordinates: { x, y },
                        button,
                    };
                }
                break;

            case "drag":
                if (x !== undefined && y !== undefined) {
                    // Move to start position
                    await smoothMouseMove(
                        currentPos.x,
                        currentPos.y,
                        x,
                        y,
                        200
                    );

                    // Mouse down
                    robot.mouseToggle("down", button);
                    await sleep(100);

                    return {
                        success: true,
                        message: `Drag started at (${x}, ${y})`,
                        action: "drag_start",
                        coordinates: { x, y },
                        button,
                    };
                }
                break;

            case "release":
                robot.mouseToggle("up", button);
                return {
                    success: true,
                    message: `Mouse button released`,
                    action: "release",
                    button,
                };

            case "scroll": {
                if (x !== undefined && y !== undefined) {
                    await smoothMouseMove(
                        currentPos.x,
                        currentPos.y,
                        x,
                        y,
                        200
                    );
                    await sleep(50);
                }

                const direction =
                    scroll_direction.toLowerCase() === "up" ? 1 : -1;
                for (let i = 0; i < scroll_amount; i++) {
                    robot.scrollMouse(0, direction);
                    await sleep(50); // Smooth scrolling
                }

                return {
                    success: true,
                    message: `Scrolled ${scroll_direction} ${scroll_amount} times${
                        x && y ? ` at (${x}, ${y})` : ""
                    }`,
                    action: "scroll",
                    coordinates: x && y ? { x, y } : null,
                    direction: scroll_direction,
                    amount: scroll_amount,
                };
            }

            default:
                return {
                    success: false,
                    error: `Unknown action: ${action}`,
                };
        }

        return {
            success: false,
            error: `Invalid parameters for action: ${action}`,
        };
    } catch (error) {
        console.error("Mouse control error:", error);
        return {
            success: false,
            error: error.message,
            details: error.stack,
        };
    }
}

module.exports = {
    controlMouse,
};
