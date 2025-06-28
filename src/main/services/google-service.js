const { getUserData } = require("./credentials-service");
const { getErrorService } = require("./error-service");
// Remove this import since we're requiring it lazily
// const { getEventsService } = require("./events-service");
const http = require("http");
const url = require("url");
const { shell } = require("electron");
const { google } = require("googleapis");

const userData = getUserData();

/**
 * Google Service
 * Manages authentication and interaction with Google APIs (Gmail, Calendar, Drive)
 */
class GoogleService {
    constructor() {
        this.clientId = process.env.GOOGLE_CLIENT_ID;
        this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        this.redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:8889/callback";
        this.scopes = [
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/calendar",
        ];
        
        // Initialize OAuth2 client
        this.oAuth2Client = new google.auth.OAuth2(
            this.clientId,
            this.clientSecret,
            this.redirectUri
        );
        
        // Initialize API clients
        this.gmail = google.gmail({ version: 'v1' });
        this.calendar = google.calendar({ version: 'v3' });
        this.drive = google.drive({ version: 'v3' });
        
        this.accessToken = null;
        this.refreshToken = null;
        this.authorized = false;
        this.errorService = null;
        this.eventsService = null;
    }

    /**
     * Initialize the service by checking for and setting stored credentials
     */
    async initialize() {
        try {
            this.errorService = getErrorService();
            // Don't initialize events service here
            // this.eventsService = await getEventsService();
            
            // Check for stored tokens
            const accessToken = await userData.getCredentials("google.accessToken");
            const refreshToken = await userData.getCredentials("google.refreshToken");
            const tokenExpiry = await userData.getCredentials("google.tokenExpiry");
            
            if (accessToken && refreshToken && tokenExpiry) {
                this.accessToken = accessToken;
                this.refreshToken = refreshToken;
                
                // Set credentials on the OAuth client
                this.oAuth2Client.setCredentials({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    expiry_date: parseInt(tokenExpiry)
                });
                
                // Check if token is expired
                if (Date.now() >= parseInt(tokenExpiry)) {
                    return await this.refreshAccessToken();
                }
                
                this.authorized = true;
                return true;
            }
            
            return false;
        } catch (error) {
            this.reportError(error, "initialize");
            return false;
        }
    }

    /**
     * Reports an error and formats it for return
     * @param {Error} error - The error that occurred
     * @param {string} method - The method where the error occurred
     * @returns {Object} - Error object with message and success flag
     */
    reportError(error, method) {
        // Report to error service if available
        if (this.errorService) {
            this.errorService.reportError(error, `google-service.${method}`);
        }
        
        // Return formatted error object
        return {
            success: false,
            error: `Error in ${method}: ${error.message}`
        };
    }

    /**
     * Start the OAuth2 authorization flow
     * @returns {Promise<boolean>} Success status
     */
    async authorize() {
        return new Promise((resolve, reject) => {
            // Create a temporary server to handle the callback
            const server = http.createServer(async (req, res) => {
                const parsedUrl = url.parse(req.url, true);

                if (parsedUrl.pathname === "/callback") {
                    // We got the callback with the authorization code
                    const code = parsedUrl.query.code;

                    if (!code) {
                        res.writeHead(400, { "Content-Type": "text/html" });
                        res.end(
                            "<h1>Authentication failed</h1><p>No authorization code received</p>"
                        );
                        server.close();
                        reject(new Error("No authorization code received"));
                        return;
                    }

                    // Display success message to the user
                    res.writeHead(200, { "Content-Type": "text/html" });
                    res.end(
                        "<h1>Google Authentication successful!</h1><p>You can close this window and return to Luna.</p>"
                    );

                    try {
                        // Exchange code for tokens
                        const { tokens } = await this.oAuth2Client.getToken(code);
                        
                        // Store tokens
                        this.accessToken = tokens.access_token;
                        this.refreshToken = tokens.refresh_token || this.refreshToken; // Keep existing refresh token if new one isn't provided
                        
                        // Set tokens on the OAuth client
                        this.oAuth2Client.setCredentials(tokens);
                        
                        // Store tokens in user data
                        await userData.setCredentials(
                            "google.accessToken",
                            tokens.access_token
                        );
                        
                        if (tokens.refresh_token) {
                            await userData.setCredentials(
                                "google.refreshToken",
                                tokens.refresh_token
                            );
                        }
                        
                        await userData.setCredentials(
                            "google.tokenExpiry",
                            String(tokens.expiry_date)
                        );
                        
                        this.authorized = true;
                        
                        server.close();
                        resolve(true);
                    } catch (error) {
                        this.reportError(error, "authorize");
                        server.close();
                        reject(error);
                    }
                }
            });
            
            // Parse the redirectUri to get the port
            const redirectUrl = new URL(this.redirectUri);
            const port = parseInt(redirectUrl.port) || 8889;
            
            // Start the server
            server.listen(port, async () => {
                try {
                    // Generate the authorization URL
                    const authUrl = this.oAuth2Client.generateAuthUrl({
                        access_type: 'offline',
                        scope: this.scopes,
                        prompt: 'consent' // Force to get refresh token
                    });
                    
                    // Open URL in user's default browser
                    await shell.openExternal(authUrl);
                } catch (error) {
                    server.close();
                    this.reportError(error, "authorize");
                    reject(
                        new Error(`Failed to open browser: ${error.message}`)
                    );
                }
            });
            
            // Handle server errors
            server.on("error", (err) => {
                this.reportError(err, "authorize-server");
                reject(err);
            });
        });
    }
    
    /**
     * Refresh access token using stored refresh token
     * @returns {Promise<boolean>} Success status
     */
    async refreshAccessToken() {
        try {
            this.oAuth2Client.setCredentials({
                refresh_token: this.refreshToken
            });
            
            const { credentials } = await this.oAuth2Client.refreshAccessToken();
            
            this.accessToken = credentials.access_token;
            
            // Set the new credentials
            this.oAuth2Client.setCredentials(credentials);
            
            // Update stored credentials
            await userData.setCredentials(
                "google.accessToken",
                credentials.access_token
            );
            
            await userData.setCredentials(
                "google.tokenExpiry",
                String(credentials.expiry_date)
            );
            
            this.authorized = true;
            return true;
        } catch (error) {
            this.reportError(error, "refreshAccessToken");
            this.authorized = false;
            return false;
        }
    }

    /**
     * Check if the service is authorized
     * @returns {boolean} Authorization status
     */
    isAuthorized() {
        return this.authorized;
    }

    /**
     * Check authorization and emit event if not authorized
     * @returns {boolean} True if authorized, false otherwise
     */
    async checkAuthorization() {
        if (!this.isAuthorized()) {
            // Try to initialize in case tokens exist but weren't loaded
            const initialized = await this.initialize();
            if (!initialized) {
                // If still not authorized, emit event
                // Lazily initialize events service only when needed
                if (!this.eventsService) {
                    const { getEventsService } = require("./events-service");
                    this.eventsService = await getEventsService();
                }
                
                if (this.eventsService) {
                    this.eventsService.emit("google-not-authorized");
                }
                return false;
            }
        }
        return true;
    }

    /**
     * Gmail API Methods
     */

    /**
     * Get unread messages from Gmail inbox
     * @param {number} maxResults - Maximum number of messages to return (default: 15)
     * @returns {Promise<Object>} - Gmail messages
     */
    async getEmails(maxResults = 15) {
        try {
            if (!await this.checkAuthorization()) {
                return { success: false, error: "Not authorized with Google" };
            }

            // Query for unread emails
            const res = await this.gmail.users.messages.list({
                auth: this.oAuth2Client,
                userId: 'me',
                maxResults: maxResults,
                q: 'is:unread' // Query parameter to get only unread emails
            });

            const messages = [];
            for (const message of res.data.messages || []) {
                const details = await this.gmail.users.messages.get({
                    auth: this.oAuth2Client,
                    userId: 'me',
                    id: message.id
                });
                
                const headers = details.data.payload.headers;
                const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
                const from = headers.find(h => h.name === 'From')?.value || '(Unknown Sender)';
                const date = headers.find(h => h.name === 'Date')?.value;
                
                messages.push({
                    id: message.id,
                    subject: subject,
                    from: from,
                    date: date,
                    snippet: details.data.snippet,
                    unread: details.data.labelIds?.includes('UNREAD') || false
                });
            }

            return { success: true, data: messages };
        } catch (error) {
            return this.reportError(error, "getEmails");
        }
    }

    /**
     * Send an email via Gmail
     * @param {string} to - Recipient email address
     * @param {string} subject - Email subject
     * @param {string} body - Email body (plain text)
     * @returns {Promise<Object>} - Result of send operation
     */
    async sendEmail(to, subject, body) {
        try {
            if (!await this.checkAuthorization()) {
                return { success: false, error: "Not authorized with Google" };
            }

            // Create the email content
            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
            const messageParts = [
                'From: Luna AI <me>',
                `To: ${to}`,
                `Subject: ${utf8Subject}`,
                'MIME-Version: 1.0',
                'Content-Type: text/plain; charset=utf-8',
                'Content-Transfer-Encoding: 7bit',
                '',
                body,
            ];
            const message = messageParts.join('\n');

            // Encode the message
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            // Send the message
            const res = await this.gmail.users.messages.send({
                auth: this.oAuth2Client,
                userId: 'me',
                requestBody: {
                    raw: encodedMessage
                }
            });

            return { success: true, data: res.data };
        } catch (error) {
            return this.reportError(error, "sendEmail");
        }
    }

    /**
     * Create a draft email in Gmail
     * @param {string} to - Recipient email address
     * @param {string} subject - Email subject
     * @param {string} body - Email body (plain text)
     * @returns {Promise<Object>} - Result of draft creation
     */
    async createDraft(to, subject, body) {
        try {
            if (!await this.checkAuthorization()) {
                return { success: false, error: "Not authorized with Google" };
            }

            // Create the email content
            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
            const messageParts = [
                'From: Luna AI <me>',
                `To: ${to}`,
                `Subject: ${utf8Subject}`,
                'MIME-Version: 1.0',
                'Content-Type: text/plain; charset=utf-8',
                'Content-Transfer-Encoding: 7bit',
                '',
                body,
            ];
            const message = messageParts.join('\n');

            // Encode the message
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            // Create a draft instead of sending
            const res = await this.gmail.users.drafts.create({
                auth: this.oAuth2Client,
                userId: 'me',
                requestBody: {
                    message: {
                        raw: encodedMessage
                    }
                }
            });

            return { success: true, data: res.data };
        } catch (error) {
            return this.reportError(error, "createDraft");
        }
    }

    /**
     * Calendar API Methods
     */

    /**
     * Get list of calendars the user has access to
     * @returns {Promise<Object>} - List of calendars
     */
    async getCalendarList() {
        try {
            if (!await this.checkAuthorization()) {
                return { success: false, error: "Not authorized with Google" };
            }

            const res = await this.calendar.calendarList.list({
                auth: this.oAuth2Client
            });

            return { success: true, data: res.data.items };
        } catch (error) {
            return this.reportError(error, "getCalendarList");
        }
    }

    /**
     * Get upcoming events from all user's calendars
     * @param {string} timeMin - ISO string for the start time (defaults to now)
     * @param {string} timeMax - ISO string for the end time (optional)
     * @returns {Promise<Object>} - Calendar events
     */
    async getCalendarEvents(timeMin = null, timeMax = null) {
        try {
            if (!await this.checkAuthorization()) {
                return { success: false, error: "Not authorized with Google" };
            }

            const requestParams = {
                auth: this.oAuth2Client,
                singleEvents: true,
                orderBy: 'startTime',
                timeMin: timeMin || (new Date()).toISOString(),
            };

            // Add timeMax if provided
            if (timeMax) {
                requestParams.timeMax = timeMax;
            }

            // Get the list of all calendars
            const calendarListResult = await this.getCalendarList();
            
            if (!calendarListResult.success) {
                return calendarListResult; // Return the error
            }
            
            const calendars = calendarListResult.data;
            let allEvents = [];
            
            // For each calendar, fetch events
            for (const calendar of calendars) {
                try {
                    const calendarId = calendar.id;
                    
                    // Skip calendars we can't read
                    if (!calendar.accessRole || calendar.accessRole === 'none') {
                        continue;
                    }
                    
                    const res = await this.calendar.events.list({
                        ...requestParams,
                        calendarId: calendarId
                    });
                    
                    // Add calendar info to each event
                    const eventsWithCalendarInfo = res.data.items.map(event => ({
                        ...event,
                        calendarId: calendarId,
                        calendarName: calendar.summary,
                        calendarColor: calendar.backgroundColor || '#4285F4'
                    }));
                    
                    allEvents = [...allEvents, ...eventsWithCalendarInfo];
                } catch (calendarError) {
                    console.error(`Error fetching events for calendar ${calendar.summary}:`, calendarError);
                    // Continue with next calendar instead of failing completely
                }
            }
            
            // Sort all events by start time
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
     * Create a calendar event
     * @param {string} summary - Event title
     * @param {string} description - Event description
     * @param {Date} startDateTime - Start date and time
     * @param {Date} endDateTime - End date and time
     * @param {string} timeZone - Time zone (defaults to local time zone)
     * @returns {Promise<Object>} - Result of create operation
     */
    async createCalendarEvent(summary, description, startDateTime, endDateTime, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
        try {
            if (!await this.checkAuthorization()) {
                return { success: false, error: "Not authorized with Google" };
            }

            const event = {
                summary,
                description,
                start: {
                    dateTime: startDateTime.toISOString(),
                    timeZone
                },
                end: {
                    dateTime: endDateTime.toISOString(),
                    timeZone
                }
            };

            const res = await this.calendar.events.insert({
                auth: this.oAuth2Client,
                calendarId: 'primary',
                requestBody: event
            });

            return { success: true, data: res.data };
        } catch (error) {
            return this.reportError(error, "createCalendarEvent");
        }
    }

    /**
     * Drive API Methods
     */

    /**
     * List files from Google Drive
     * @param {number} maxResults - Maximum number of files to return
     * @returns {Promise<Object>} - Drive files
     */
    async listDriveFiles(maxResults = 10) {
        try {
            if (!await this.checkAuthorization()) {
                return { success: false, error: "Not authorized with Google" };
            }

            const res = await this.drive.files.list({
                auth: this.oAuth2Client,
                pageSize: maxResults,
                fields: 'nextPageToken, files(id, name, mimeType, webViewLink)',
            });

            return { success: true, data: res.data.files };
        } catch (error) {
            return this.reportError(error, "listDriveFiles");
        }
    }

    /**
     * Factory method to create and initialize a GoogleService instance
     * @returns {Promise<GoogleService>} Initialized GoogleService
     */
    static async create() {
        const service = new GoogleService();
        await service.initialize();
        return service;
    }
}

let googleService = null;

/**
 * Get a singleton instance of GoogleService
 * @returns {Promise<GoogleService>} GoogleService instance
 */
async function getGoogleService() {
    if (!googleService) {
        googleService = await GoogleService.create();
    }
    return googleService;
}

module.exports = { getGoogleService };

