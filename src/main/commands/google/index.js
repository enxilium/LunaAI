const {
    getGoogleService,
} = require("../../services/integrations/google-service");
const { getErrorService } = require("../../services/error-service");

/**
 * Get unread emails from Gmail.
 * @returns {Promise<Object>} - An array of email objects or an error object.
 */
async function checkEmails() {
    try {
        console.log("Checking unread emails");
        const googleService = await getGoogleService();
        if (!googleService.isAuthorized()) {
            throw new Error("SERVICE NOT AUTHORIZED");
        }
        const result = await googleService.getEmails(15); // Fetch up to 15 emails

        if (!result.success) {
            throw new Error(result.error);
        }

        // The LLM will be responsible for summarizing this data.
        return result.data;
    } catch (error) {
        getErrorService().reportError(error, "google-command-checkEmails");
        if (error.message === "SERVICE NOT AUTHORIZED") {
            return {
                error: "Google account not connected.",
                error_solution:
                    "I can't do that because you haven't connected your Google account. Please connect your account in the settings.",
            };
        }
        return {
            error: error.message,
            error_solution:
                "I couldn't check your emails. Please ensure your Google account is connected and try again.",
        };
    }
}

/**
 * Create a draft email in Gmail.
 * @param {Object} args - Arguments from the tool call.
 * @param {string} args.recipient - The email address of the recipient.
 * @param {string} args.subject - The subject of the email.
 * @param {string} args.body - The body content of the email.
 * @returns {Promise<Object>} - A success or error object.
 */
async function draftEmail({ recipient, subject, body }) {
    try {
        if (!recipient || !subject || !body) {
            throw new Error(
                "Recipient, subject, and body are required to draft an email."
            );
        }

        console.log(`Creating email draft to: ${recipient}`);
        const googleService = await getGoogleService();
        if (!googleService.isAuthorized()) {
            throw new Error("SERVICE NOT AUTHORIZED");
        }
        const result = await googleService.createDraft(
            recipient,
            subject,
            body
        );

        if (!result.success) {
            throw new Error(result.error);
        }

        return {
            success: true,
            message: `Email draft to ${recipient} created successfully.`,
        };
    } catch (error) {
        getErrorService().reportError(error, "google-command-draftEmail");
        if (error.message === "SERVICE NOT AUTHORIZED") {
            return {
                error: "Google account not connected.",
                error_solution:
                    "I can't do that because you haven't connected your Google account. Please connect your account in the settings.",
            };
        }
        return {
            error: error.message,
            error_solution:
                "I encountered an issue creating your email draft. Please check the details and try again.",
        };
    }
}

/**
 * Get upcoming events from Google Calendar.
 * @returns {Promise<Object>} - An array of event objects or an error object.
 */
async function getCalendarEvents() {
    try {
        console.log("Getting calendar events");
        const googleService = await getGoogleService();
        if (!googleService.isAuthorized()) {
            throw new Error("SERVICE NOT AUTHORIZED");
        }
        const result = await googleService.getCalendarEvents(null, null);

        if (!result.success) {
            throw new Error(result.error);
        }

        // The LLM will summarize this data.
        return result.data;
    } catch (error) {
        getErrorService().reportError(
            error,
            "google-command-getCalendarEvents"
        );
        if (error.message === "SERVICE NOT AUTHORIZED") {
            return {
                error: "Google account not connected.",
                error_solution:
                    "I can't do that because you haven't connected your Google account. Please connect your account in the settings.",
            };
        }
        return {
            error: error.message,
            error_solution:
                "I had trouble getting your calendar events. Please ensure your Google account is connected.",
        };
    }
}

/**
 * Create a new event in Google Calendar.
 * @param {Object} args - Arguments from the tool call.
 * @param {string} args.title - The title of the event.
 * @param {string} args.startTime - The start time in ISO format.
 * @param {string} args.endTime - The end time in ISO format.
 * @param {string} [args.location] - The location of the event.
 * @returns {Promise<Object>} - The created event object or an error object.
 */
async function createCalendarEvent({ title, startTime, endTime, location }) {
    try {
        if (!title || !startTime || !endTime) {
            throw new Error(
                "Title, start time, and end time are required to create a calendar event."
            );
        }

        console.log(`Creating calendar event: ${title}`);
        const googleService = await getGoogleService();
        if (!googleService.isAuthorized()) {
            throw new Error("SERVICE NOT AUTHORIZED");
        }
        const result = await googleService.createCalendarEvent({
            summary: title,
            description: `Event created by Luna AI`,
            start: { dateTime: startTime, timeZone: "America/Toronto" }, // Assuming a default timezone
            end: { dateTime: endTime, timeZone: "America/Toronto" },
            location: location,
        });

        if (!result.success) {
            throw new Error(result.error);
        }

        return result.data;
    } catch (error) {
        getErrorService().reportError(
            error,
            "google-command-createCalendarEvent"
        );
        if (error.message === "SERVICE NOT AUTHORIZED") {
            return {
                error: "Google account not connected.",
                error_solution:
                    "I can't do that because you haven't connected your Google account. Please connect your account in the settings.",
            };
        }
        return {
            error: error.message,
            error_solution:
                "I couldn't create the calendar event. Please check the event details and that your Google account is connected.",
        };
    }
}

/**
 * List files from Google Drive.
 * @returns {Promise<Object>} - An array of file objects or an error object.
 */
async function listDriveFiles() {
    try {
        console.log("Listing drive files");
        const googleService = await getGoogleService();
        if (!googleService.isAuthorized()) {
            throw new Error("SERVICE NOT AUTHORIZED");
        }
        const result = await googleService.listDriveFiles(15); // Fetch up to 15 files

        if (!result.success) {
            throw new Error(result.error);
        }

        // The LLM will summarize this.
        return result.data;
    } catch (error) {
        getErrorService().reportError(error, "google-command-listDriveFiles");
        if (error.message === "SERVICE NOT AUTHORIZED") {
            return {
                error: "Google account not connected.",
                error_solution:
                    "I can't do that because you haven't connected your Google account. Please connect your account in the settings.",
            };
        }
        return {
            error: error.message,
            error_solution:
                "I had trouble listing your Google Drive files. Please ensure your Google account is connected.",
        };
    }
}

module.exports = {
    checkEmails,
    draftEmail,
    getCalendarEvents,
    createCalendarEvent,
    listDriveFiles,
};
