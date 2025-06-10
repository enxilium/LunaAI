const { useSpotifyService } = require("../main/commands/spotify/index.js");
const getSpotifyService = require("../main/services/spotify-service");

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

function log(message, type = "info") {
    const timestamp = new Date().toISOString();
    switch (type) {
        case "success":
            console.log(
                `${colors.green}[${timestamp}] ✓ ${message}${colors.reset}`
            );
            break;
        case "error":
            console.log(
                `${colors.red}[${timestamp}] ✖ ${message}${colors.reset}`
            );
            break;
        case "warning":
            console.log(
                `${colors.yellow}[${timestamp}] ⚠ ${message}${colors.reset}`
            );
            break;
        case "header":
            console.log(
                `\n${colors.bright}${colors.cyan}${message}${colors.reset}\n`
            );
            break;
        default:
            console.log(`[${timestamp}] ${message}`);
    }
}

// Test command function
async function testCommand(commandName, args = {}) {
    try {
        log(`Testing '${commandName}' command...`);
        const result = await useSpotifyService({
            command: commandName,
            ...args,
        });
        log(`Command '${commandName}' executed successfully`, "success");
        return result;
    } catch (error) {
        log(`Command '${commandName}' failed: ${error.message}`, "error");
        return null;
    }
}

// Check authorization first
async function checkAuth() {
    try {
        const spotify = await getSpotifyService();
        const isAuthorized = spotify.isAuthorized();
        log(
            `Authorization status: ${isAuthorized}`,
            isAuthorized ? "success" : "warning"
        );
        return isAuthorized;
    } catch (error) {
        log(`Authorization check failed: ${error.message}`, "error");
        return false;
    }
}

// Get playback state to see what's happening
async function getPlaybackStatus() {
    try {
        const spotify = await getSpotifyService();
        const state = await spotify.getPlaybackState();
        if (!state) {
            log(
                "No active playback found. Please start playing something on Spotify.",
                "warning"
            );
            return null;
        }

        const track = state.item
            ? `"${state.item.name}" by ${state.item.artists
                  .map((a) => a.name)
                  .join(", ")}`
            : "Unknown track";

        log(
            `Current playback: ${track} (${
                state.is_playing ? "Playing" : "Paused"
            })`,
            "info"
        );
        return state;
    } catch (error) {
        log(`Failed to get playback state: ${error.message}`, "error");
        return null;
    }
}

// Main test function
async function runTests() {
    log("SPOTIFY COMMANDS TEST SCRIPT", "header");

    // Check authorization first
    if (!(await checkAuth())) {
        log(
            "Not authenticated with Spotify. Please authorize first.",
            "warning"
        );
        return;
    }

    // Get initial state
    await getPlaybackStatus();

    // Test all commands in sequence
    log("Testing Playback Commands", "header");

    // Test pause
    log("Testing pause command...");
    await testCommand("pause");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await getPlaybackStatus();

    // Test play
    log("Testing play command...");
    await testCommand("play"); // without trackId means resume
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await getPlaybackStatus();

    // Test volume
    log("Testing volume command...");
    await testCommand("volume", { volume: 50 });
    log("Volume set to 50%", "success");
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Test next track
    log("Testing next track command...");
    await testCommand("next");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await getPlaybackStatus();

    // Test previous track
    log("Testing previous track command...");
    await testCommand("previous");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await getPlaybackStatus();

    // Restore volume
    log("Restoring volume to 80%...");
    await testCommand("volume", { volume: 80 });

    log("All tests completed!", "header");
}

// Run the tests
runTests().catch((err) => {
    log(`Unhandled error: ${err.message}`, "error");
    console.error(err);
});
