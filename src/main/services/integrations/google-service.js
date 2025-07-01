const { google } = require("googleapis");
const { EventEmitter } = require("events");
const http = require("http");
const url = require("url");
const { shell } = require("electron");
const { getErrorService } = require("../error-service");
const { getCredentialsService } = require("../user/credentials-service");
const { getSettingsService } = require("../user/settings-service");

let googleService = null;

/**
 * @description Get the singleton google service instance.
 * @returns {Promise<GoogleService>} The google service instance.
 */
async function getGoogleService() {
    if (!googleService) {
        const credentialsService = getCredentialsService();
        const settingsService = getSettingsService();
        googleService = new GoogleService(credentialsService, settingsService);
        await googleService.initialize();
    }
    return googleService;
}

/**
 * @class GoogleService
 * @description A service for interacting with the Google API.
 * @extends EventEmitter
 */
class GoogleService extends EventEmitter {
    constructor(credentialsService, settingsService) {
        super();
        this.credentialsService = credentialsService;
        this.settingsService = settingsService;
        this.oAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            "http://localhost:8889/callback"
        );
        this.gmail = google.gmail({ version: "v1", auth: this.oAuth2Client });
        this.calendar = google.calendar({
            version: "v3",
            auth: this.oAuth2Client,
        });
        this.drive = google.drive({ version: "v3", auth: this.oAuth2Client });
        this.isRefreshing = false;
        this.errorService = getErrorService();
    }

    /**
     * @description Reports an error and formats it for return
     * @param {Error} error - The error that occurred
     * @param {string} method - The method where the error occurred
     * @returns {Object} - Error object with message and success flag
     */
    reportError(error, method) {
        this.errorService.reportError(error, `google-service.${method}`);
        return {
            success: false,
            error: `Error in ${method}: ${error.message}`,
        };
    }

    /**
     * @description Initialize the service by loading credentials from the store.
     */
    async initialize() {
        const accessToken = await this.credentialsService.getCredentials(
            "google.accessToken"
        );
        const refreshToken = await this.credentialsService.getCredentials(
            "google.refreshToken"
        );
        const expiryDate = await this.credentialsService.getCredentials(
            "google.expiryDate"
        );

        if (accessToken && refreshToken && expiryDate) {
            this.oAuth2Client.setCredentials({
                access_token: accessToken,
                refresh_token: refreshToken,
                expiry_date: parseInt(expiryDate, 10),
            });

            if (new Date() >= new Date(parseInt(expiryDate, 10))) {
                await this.refreshAccessToken();
            } else {
                this.settingsService.setConfig("googleAuth", true);
            }
        }
    }

    /**
     * @description Checks if the user is authorized with Google.
     * @returns {boolean} - True if authorized, false otherwise.
     */
    isAuthorized() {
        return this.settingsService.getConfig("googleAuth") === true;
    }

    /**
     * @description Authorize the application with Google.
     * @returns {Promise<boolean>} A promise that resolves with true if the authorization was successful, and false otherwise.
     */
    async authorize() {
        return new Promise((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                const parsedUrl = url.parse(req.url, true);
                if (parsedUrl.pathname === "/callback") {
                    const code = parsedUrl.query.code;
                    if (!code) {
                        res.end("Authentication failed.");
                        server.close();
                        return reject(new Error("No authorization code."));
                    }
                    res.end(
                        "Authentication successful! You can close this window."
                    );
                    server.close();
                    try {
                        const { tokens } = await this.oAuth2Client.getToken(
                            code
                        );
                        this.oAuth2Client.setCredentials(tokens);

                        await this.credentialsService.setCredentials(
                            "google.accessToken",
                            tokens.access_token
                        );
                        if (tokens.refresh_token) {
                            await this.credentialsService.setCredentials(
                                "google.refreshToken",
                                tokens.refresh_token
                            );
                        }
                        await this.credentialsService.setCredentials(
                            "google.expiryDate",
                            tokens.expiry_date.toString()
                        );
                        this.settingsService.setConfig("googleAuth", true);
                        resolve(true);
                    } catch (error) {
                        this.errorService.reportError(
                            error,
                            "google-auth-grant"
                        );
                        this.settingsService.setConfig("googleAuth", false);
                        reject(false);
                    }
                }
            });

            server.listen(8889, () => {
                const authUrl = this.oAuth2Client.generateAuthUrl({
                    access_type: "offline",
                    scope: [
                        "https://www.googleapis.com/auth/gmail.modify",
                        "https://www.googleapis.com/auth/calendar",
                    ],
                    prompt: "consent",
                });
                shell.openExternal(authUrl);
            });
        });
    }

    /**
     * @description Refresh the access token.
     */
    async refreshAccessToken() {
        if (this.isRefreshing) {
            return;
        }
        this.isRefreshing = true;

        try {
            const { credentials } =
                await this.oAuth2Client.refreshAccessToken();
            this.oAuth2Client.setCredentials(credentials);

            await this.credentialsService.setCredentials(
                "google.accessToken",
                credentials.access_token
            );
            await this.credentialsService.setCredentials(
                "google.expiryDate",
                credentials.expiry_date.toString()
            );
            this.settingsService.setConfig("googleAuth", true);
        } catch (error) {
            this.errorService.reportError(error, "google-refresh-token");
            this.settingsService.setConfig("googleAuth", false);
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * @description Disconnect the application from Google.
     */
    async disconnect() {
        return new Promise(async (resolve, reject) => {
            await this.credentialsService.deleteCredentials("google.accessToken");
            await this.credentialsService.deleteCredentials("google.refreshToken");
            await this.credentialsService.deleteCredentials("google.expiryDate");
            this.settingsService.setConfig("googleAuth", false);
            this.oAuth2Client.setCredentials(null);
            resolve(true);
        });
    }

    /**
     * @description Get unread emails from Gmail.
     * @param {number} maxResults The maximum number of results to return.
     * @returns {Promise<Object[]>} A list of unread emails.
     */
    async getEmails(maxResults = 15) {
        try {
            const res = await this.gmail.users.messages.list({
                userId: "me",
                maxResults,
                q: "is:unread",
            });

            const messages = [];
            for (const message of res.data.messages || []) {
                const details = await this.gmail.users.messages.get({
                    userId: "me",
                    id: message.id,
                });

                const headers = details.data.payload.headers;
                const subject =
                    headers.find((h) => h.name === "Subject")?.value ||
                    "(No Subject)";
                const from =
                    headers.find((h) => h.name === "From")?.value ||
                    "(Unknown Sender)";
                const date = headers.find((h) => h.name === "Date")?.value;

                messages.push({
                    id: message.id,
                    subject: subject,
                    from: from,
                    date: date,
                    snippet: details.data.snippet,
                    unread: details.data.labelIds?.includes("UNREAD") || false,
                });
            }
            return { success: true, data: messages };
        } catch (error) {
            return this.reportError(error, "getEmails");
        }
    }

    /**
     * @description Send an email.
     * @param {string} to The recipient's email address.
     * @param {string} subject The email subject.
     * @param {string} body The email body.
     * @returns {Promise<Object>} The sent email.
     */
    async sendEmail(to, subject, body) {
        try {
            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString(
                "base64"
            )}?=`;
            const messageParts = [
                "From: Luna AI <me>",
                `To: ${to}`,
                `Subject: ${utf8Subject}`,
                "MIME-Version: 1.0",
                "Content-Type: text/plain; charset=utf-8",
                "Content-Transfer-Encoding: 7bit",
                "",
                body,
            ];
            const message = messageParts.join("\n");

            const encodedMessage = Buffer.from(message)
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");

            const { data } = await this.gmail.users.messages.send({
                userId: "me",
                requestBody: {
                    raw: encodedMessage,
                },
            });
            return { success: true, data };
        } catch (error) {
            return this.reportError(error, "sendEmail");
        }
    }

    /**
     * @description Create a draft email.
     * @param {string} to The recipient's email address.
     * @param {string} subject The email subject.
     * @param {string} body The email body.
     * @returns {Promise<Object>} The created draft.
     */
    async createDraft(to, subject, body) {
        try {
            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString(
                "base64"
            )}?=`;
            const messageParts = [
                "From: Luna AI <me>",
                `To: ${to}`,
                `Subject: ${utf8Subject}`,
                "MIME-Version: 1.0",
                "Content-Type: text/plain; charset=utf-8",
                "Content-Transfer-Encoding: 7bit",
                "",
                body,
            ];
            const message = messageParts.join("\n");

            const encodedMessage = Buffer.from(message)
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");

            const { data } = await this.gmail.users.drafts.create({
                userId: "me",
                requestBody: {
                    message: {
                        raw: encodedMessage,
                    },
                },
            });
            return { success: true, data };
        } catch (error) {
            return this.reportError(error, "createDraft");
        }
    }

    /**
     * @description Get the user's calendar list.
     * @returns {Promise<Object[]>} The user's calendar list.
     */
    async getCalendarList() {
        try {
            const { data } = await this.calendar.calendarList.list();
            return { success: true, data: data.items };
        } catch (error) {
            return this.reportError(error, "getCalendarList");
        }
    }

    /**
     * @description Get events from the user's calendars.
     * @param {string} timeMin The minimum time for events.
     * @param {string} timeMax The maximum time for events.
     * @returns {Promise<Object[]>} A list of calendar events.
     */
    async getCalendarEvents(timeMin = null, timeMax = null) {
        try {
            const requestParams = {
                singleEvents: true,
                orderBy: "startTime",
                timeMin: timeMin || new Date().toISOString(),
            };

            if (timeMax) {
                requestParams.timeMax = timeMax;
            }

            const calendarsResult = await this.getCalendarList();
            if (!calendarsResult.success) return calendarsResult;

            const calendars = calendarsResult.data;
            let allEvents = [];

            for (const calendar of calendars) {
                try {
                    if (
                        !calendar.accessRole ||
                        calendar.accessRole === "none"
                    ) {
                        continue;
                    }

                    const { data } = await this.calendar.events.list({
                        ...requestParams,
                        calendarId: calendar.id,
                    });

                    const eventsWithCalendarInfo = data.items.map((event) => ({
                        ...event,
                        calendarId: calendar.id,
                        calendarName: calendar.summary,
                        calendarColor: calendar.backgroundColor || "#4285F4",
                    }));

                    allEvents = [...allEvents, ...eventsWithCalendarInfo];
                } catch (calendarError) {
                    this.errorService.reportError(
                        calendarError,
                        `google-get-events-${calendar.summary}`
                    );
                }
            }

            allEvents.sort((a, b) => {
                const aStart = a.start.dateTime || a.start.date;
                const bStart = b.start.dateTime || b.start.date;
                return new Date(aStart) - new Date(bStart);
            });

            return { success: true, data: allEvents };
        } catch (error) {
            return this.reportError(error, "getCalendarEvents");
        }
    }

    /**
     * @description Create a calendar event.
     * @param {Object} event The event to create.
     * @returns {Promise<Object>} The created event.
     */
    async createCalendarEvent(event) {
        try {
            const { data } = await this.calendar.events.insert({
                calendarId: "primary",
                requestBody: event,
            });
            return { success: true, data };
        } catch (error) {
            return this.reportError(error, "createCalendarEvent");
        }
    }

    /**
     * @description List files from Google Drive.
     * @param {number} maxResults The maximum number of results to return.
     * @returns {Promise<Object[]>} A list of files from Google Drive.
     */
    async listDriveFiles(maxResults = 10) {
        try {
            const { data } = await this.drive.files.list({
                pageSize: maxResults,
                fields: "nextPageToken, files(id, name, mimeType, webViewLink)",
            });
            return { success: true, data: data.files };
        } catch (error) {
            return this.reportError(error, "listDriveFiles");
        }
    }
}

module.exports = { getGoogleService };
