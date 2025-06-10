const keytar = require("keytar");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Constants
const SERVICE_NAME = "Luna";
const APP_NAME = "luna-ai";
const ELECTRON_STORE_DIR = path.join(
    os.homedir(),
    "AppData",
    "Roaming",
    APP_NAME
);

// Helper to clear keytar entries
async function clearKeytar() {
    try {
        console.log("Clearing Keytar credentials...");

        // Find all accounts for the service
        const accounts = await keytar.findCredentials(SERVICE_NAME);

        if (accounts.length === 0) {
            console.log("No credentials found in keytar for", SERVICE_NAME);
        } else {
            // Delete each account/password pair
            for (const account of accounts) {
                await keytar.deletePassword(SERVICE_NAME, account.account);
                console.log(`Deleted credential: ${account.account}`);
            }
            console.log(`Removed ${accounts.length} credentials from keytar`);
        }

        // Also clear specific known credentials if needed
        try {
            await keytar.deletePassword(SERVICE_NAME, "spotify.accessToken");
            await keytar.deletePassword(SERVICE_NAME, "spotify.refreshToken");
            console.log("Cleared specific Spotify tokens");
        } catch (specificError) {
            // Ignore errors if these specific credentials don't exist
        }

        return true;
    } catch (error) {
        console.error("Error clearing keytar credentials:", error);
        return false;
    }
}

// Helper to clear Electron store
function clearElectronStore() {
    try {
        console.log("Clearing Electron Store data...");

        if (fs.existsSync(ELECTRON_STORE_DIR)) {
            const files = fs.readdirSync(ELECTRON_STORE_DIR);

            if (files.length === 0) {
                console.log("No Electron Store files found");
            } else {
                // Delete each file in the directory
                for (const file of files) {
                    const filePath = path.join(ELECTRON_STORE_DIR, file);
                    if (fs.statSync(filePath).isDirectory()) {
                        console.log(`Skipping directory: ${filePath}`);
                        continue;
                    }
                    fs.unlinkSync(filePath);
                    console.log(`Deleted: ${filePath}`);
                }
                console.log(
                    `Removed ${files.length} files from Electron Store`
                );
            }
        } else {
            console.log("Electron Store directory not found");
        }
        return true;
    } catch (error) {
        console.error("Error clearing Electron Store:", error);
        return false;
    }
}

// Run the cleanup
async function wipeAllData() {
    console.log("Starting data wipe for Luna AI...");
    console.log(
        "IMPORTANT: Make sure your application is completely closed before continuing!"
    );
    console.log(
        "Press Ctrl+C to cancel if the app is still running, or wait 5 seconds to continue..."
    );

    // Wait 5 seconds to give the user a chance to cancel
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const keytarResult = await clearKeytar();
    const storeResult = clearElectronStore();

    if (keytarResult && storeResult) {
        console.log("Data wipe complete! Application data has been reset.");
    } else {
        console.log(
            "Data wipe partially completed. Some items may not have been removed."
        );
    }
}

wipeAllData();
