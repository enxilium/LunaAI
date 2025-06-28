const { getGoogleService } = require("../../services/google-service");
const { getErrorService } = require("../../services/error-service");
const { getNLGService } = require("../../services/nlg-service");
const { toTitleCase } = require("../../utils/string-formatting");
const { parseCalendarDatetime, parseEventDatetime } = require("../../utils/datetime-parser");

/**
 * Get unread emails from Gmail
 * @param {Object} context_map - Context map from wit.ai
 * @returns {Promise<Object>} - Updated context_map with response or error
 */
async function checkEmails(context_map) {
    try {
        console.log("Checking unread emails");
        
        const googleService = await getGoogleService();
        const maxResults = context_map.max_results || 15; // Default to 15 or use specified value
        
        const result = await googleService.getEmails(maxResults);
        
        // Check if there was an error
        if (!result.success && result.error) {
            context_map.error = result.error;
            context_map.error_solution = `I couldn't check your emails. ${
                !googleService.isAuthorized() 
                    ? "Please connect your Google account in settings." 
                    : "Please check your internet connection and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(result.error, 'google-command-checkEmails');
            
            return { context_map, stop: false };
        }
        
        // Store the emails in context map
        context_map.emails = result.data;
        
        // Generate natural language description using NLG service
        if (result.data.length > 0) {
            const nlgService = await getNLGService();
            
            const emailOptions = {
                maxEmails: context_map.max_highlight || 5,
                detailLevel: context_map.detail_level || "medium"
            };
            
            try {
                // Generate natural language summary of emails
                const nlgSummary = await nlgService.generateEmailSummary(
                    result.data,
                    emailOptions
                );
                
                // Use the NLG-generated summary as the main summary
                context_map.summary = nlgSummary;
                
                // Also store email count for possible use in other parts of the app
                context_map.email_count = result.data.length;
            } catch (nlgError) {
                console.error("Error generating NLG email summary:", nlgError);
                
                // Report the error
                const errorService = getErrorService();
                errorService.reportError(nlgError, 'google-command-checkEmails-nlg');
                
                // Set error information in context map for proper handling
                context_map.nlg_error = true;
                context_map.summary = "I found your emails, but I'm having trouble generating a detailed summary right now. I can try again later, or you can check them directly in your inbox.";
            }
            
            // Store detailed information about each email for potential reply
            // Create a map of emails by index for easy reference
            context_map.email_details = {};
            
            result.data.forEach((email, index) => {
                context_map.email_details[index + 1] = {
                    id: email.id,
                    threadId: email.threadId,
                    from: email.from,
                    to: email.to,
                    subject: email.subject,
                    snippet: email.snippet,
                    body: email.body,
                    date: email.date
                };
            });
            
            // Store the most recent email details for immediate reply scenario
            if (result.data.length > 0) {
                const latestEmail = result.data[0]; // Assuming emails are sorted by date
                context_map.latest_email = {
                    id: latestEmail.id,
                    threadId: latestEmail.threadId,
                    from: latestEmail.from,
                    to: latestEmail.to,
                    subject: latestEmail.subject,
                    snippet: latestEmail.snippet,
                    body: latestEmail.body,
                    date: latestEmail.date
                };
                
                // Extract sender email for potential reply
                const senderMatch = latestEmail.from.match(/<([^>]+)>/);
                context_map.latest_sender = senderMatch ? senderMatch[1] : latestEmail.from;
                
                // Format subject for reply (add Re: if not already present)
                context_map.reply_subject = latestEmail.subject.startsWith('Re:') 
                    ? latestEmail.subject 
                    : `Re: ${latestEmail.subject}`;
            }
        } else {
            context_map.summary = "You don't have any unread emails.";
        }
        
    } catch (error) {
        // Handle any unexpected errors
        const errorService = getErrorService();
        errorService.reportError(error, 'google-command-checkEmails');
        
        context_map.error = error.message;
        context_map.error_solution = "I encountered an issue checking your emails. Please make sure you're connected to your Google account and try again.";
    } finally {
        return { context_map, stop: false };
    }
}

/**
 * Create a draft email in Gmail
 * @param {Object} context_map - Context map from wit.ai
 * @returns {Promise<Object>} - Updated context_map with response or error
 */
async function draftEmails(context_map) {
    try {
        // Default to replying to the latest email if no specific recipient is provided
        let recipient = context_map.recipient;
        let subject = context_map.subject;
        let body = context_map.body;
        let originalEmail = null;
        
        // Check if this is a reply to a specific email (by index)
        if (context_map.email_index && context_map.email_details && context_map.email_details[context_map.email_index]) {
            // Get the email details for the specified index
            originalEmail = context_map.email_details[context_map.email_index];
            
            // Extract recipient from the original email's sender
            const senderMatch = originalEmail.from.match(/<([^>]+)>/);
            recipient = recipient || (senderMatch ? senderMatch[1] : originalEmail.from);
            
            // Format subject for reply if not explicitly provided
            subject = subject || (originalEmail.subject.startsWith('Re:') 
                ? originalEmail.subject 
                : `Re: ${originalEmail.subject}`);
        } 
        // Otherwise, use the latest email if available
        else if (!recipient && context_map.latest_sender) {
            recipient = context_map.latest_sender;
            subject = subject || context_map.reply_subject || "Message from Luna AI";
            originalEmail = context_map.latest_email;
        }
        
        // If still no recipient specified, return an error
        if (!recipient) {
            context_map.error = "No recipient specified";
            context_map.error_solution = "Please specify who you want to draft the email to.";
            return { context_map, stop: false };
        }
        
        // Set default subject if not provided
        subject = subject || "Message from Luna AI";
        
        // If no body is provided and we have an original email, generate a response using NLG
        if (!body && originalEmail) {
            console.log("Generating email response using NLG");
            
            const nlgService = await getNLGService();
            
            const emailOptions = {
                responseType: context_map.response_type || "general reply",
                tone: context_map.tone || "professional",
                includeOriginal: context_map.include_original || false,
                signature: context_map.signature || "Me"
            };
            
            try {
                // Generate email response based on original email
                body = await nlgService.generateEmailResponse(
                    originalEmail,
                    emailOptions
                );
            } catch (nlgError) {
                console.error("Error generating NLG email response:", nlgError);
                context_map.error = "Failed to generate email response";
                context_map.error_solution = "I couldn't generate an email response. Please provide the email content manually.";
                return { context_map, stop: false };
            }
        }
        
        // If still no body content, return an error
        if (!body) {
            context_map.error = "No email content specified";
            context_map.error_solution = "Please specify what you want to say in the email.";
            return { context_map, stop: false };
        }
        
        console.log(`Creating email draft to: ${recipient}`);
        
        const googleService = await getGoogleService();
        // Call createDraft instead of sendEmail (we'll need to update the Google service)
        const result = await googleService.createDraft(recipient, subject, body);
        
        // Check if there was an error
        if (!result.success && result.error) {
            context_map.error = result.error;
            context_map.error_solution = `I couldn't create your email draft. ${
                !googleService.isAuthorized() 
                    ? "Please connect your Google account in settings." 
                    : "Please check your internet connection and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(result.error, 'google-command-draftEmail');
            
            return { context_map, stop: false };
        }
        
        // Store success message
        context_map.email_drafted = true;
        context_map.summary = `Email draft to ${recipient} created successfully. You can review and send it from your Gmail account.`;
        
        return { context_map, stop: false };
    } catch (error) {
        // Handle any unexpected errors
        const errorService = getErrorService();
        errorService.reportError(error, 'google-command-draftEmail');
        
        context_map.error = error.message;
        context_map.error_solution = "I encountered an issue creating your email draft. Please make sure you're connected to your Google account and try again.";
        
        return { context_map, stop: false };
    }
}

/**
 * Get upcoming events from Google Calendar
 * @param {Object} context_map - Context map from wit.ai
 * @returns {Promise<Object>} - Updated context_map with response or error
 */
async function getCalendarEvents(context_map) {
    try {
        console.log("Checking calendar events");
        
        const googleService = await getGoogleService();
        
        // Parse datetime using the utility function
        const parsedDatetime = parseCalendarDatetime(context_map);
        
        // Store the original datetime text for response formatting if available
        if (parsedDatetime.body) {
            context_map.datetime_text = parsedDatetime.body;
        }
        
        const result = await googleService.getCalendarEvents(parsedDatetime.timeMin, parsedDatetime.timeMax);
        
        // Check if there was an error
        if (!result.success && result.error) {
            context_map.error = result.error;
            context_map.error_solution = `I couldn't check your calendar. ${
                !googleService.isAuthorized() 
                    ? "Please connect your Google account in settings." 
                    : "Please check your internet connection and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(result.error, 'google-command-getCalendarEvents');
            
            return { context_map, stop: false };
        }
        
        // Store the events in context map
        context_map.calendar_events = result.data;
        console.log("Calendar events:", context_map.calendar_events);
        
        // Generate natural language description using NLG service
        if (result.data.length > 0) {
            const nlgService = await getNLGService();
            
            const calendarOptions = {
                timeFrame: context_map.datetime_text || parsedDatetime.description || "upcoming",
                maxEvents: 10, // Default to 10
                includeCalendarNames: true // Always include calendar names in summary
            };

            console.log("Calling generateCalendarSummary with options:", calendarOptions);
            
            try {
                // Generate natural language summary of calendar events
                const nlgSummary = await nlgService.generateCalendarSummary(
                    result.data,
                    calendarOptions
                );
                
                // Use the NLG-generated summary as the main summary
                context_map.summary = nlgSummary;
                
                // Also store event count for possible use in other parts of the app
                context_map.calendar_event_count = result.data.length;
                
                // Store the number of unique calendars
                const uniqueCalendars = new Set(result.data.map(event => event.calendarId));
                context_map.calendar_count = uniqueCalendars.size;
            } catch (nlgError) {
                console.error("Error generating NLG calendar summary:", nlgError);
                
                // Report the error
                const errorService = getErrorService();
                errorService.reportError(nlgError, 'google-command-getCalendarEvents-nlg');
                
                // Set error information in context map for proper handling
                context_map.nlg_error = true;
                context_map.summary = "I found your calendar events, but I'm having trouble generating a detailed summary right now. I can try again later, or you can check them directly in your calendar.";
            }
        } else {
            const timeFrame = context_map.datetime_text || parsedDatetime.description || "upcoming";
            context_map.summary = `You don't have any ${timeFrame} events across your calendars.`;
        }

        console.log("Calendar summary:", context_map.summary);
        
        return { context_map, stop: false };
    } catch (error) {
        // Handle any unexpected errors
        const errorService = getErrorService();
        errorService.reportError(error, 'google-command-getCalendarEvents');
        
        context_map.error = error.message;
        context_map.error_solution = "I encountered an issue checking your calendar. Please make sure you're connected to your Google account and try again.";
        
        return { context_map, stop: false };
    }
}

/**
 * Create a new event in Google Calendar
 * @param {Object} context_map - Context map from wit.ai
 * @returns {Promise<Object>} - Updated context_map with response or error
 */
async function createCalendarEvent(context_map) {
    try {
        const event_title = context_map.event_title ? toTitleCase(context_map.event_title) : null;
        const event_description = context_map.event_description || "";
        
        // Parse event datetime using the utility function
        const { startDateTime, endDateTime, description: event_date_text } = parseEventDatetime(context_map);
        
        if (!event_title) {
            context_map.error = "No event title specified";
            context_map.error_solution = "Please specify a title for the calendar event.";
            return { context_map, stop: false };
        }
        
        if (!startDateTime || !endDateTime) {
            context_map.error = "No event date specified";
            context_map.error_solution = "Please specify when the event should take place.";
            return { context_map, stop: false };
        }
        
        console.log(`Creating calendar event: ${event_title} from ${startDateTime.toISOString()} to ${endDateTime.toISOString()}`);
        
        const googleService = await getGoogleService();
        const result = await googleService.createCalendarEvent(
            event_title,
            event_description,
            startDateTime,
            endDateTime
        );
        
        // Check if there was an error
        if (!result.success && result.error) {
            context_map.error = result.error;
            context_map.error_solution = `I couldn't create your calendar event. ${
                !googleService.isAuthorized() 
                    ? "Please connect your Google account in settings." 
                    : "Please check your internet connection and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(result.error, 'google-command-createCalendarEvent');
            
            return { context_map, stop: false };
        }
        
        // Store success message
        context_map.event_created = true;
        context_map.event_date_text = event_date_text; // Store the parsed event text for response
        context_map.summary = `Event "${event_title}" created successfully for ${event_date_text || startDateTime.toLocaleString()}.`;
        
        return { context_map, stop: false };
    } catch (error) {
        // Handle any unexpected errors
        const errorService = getErrorService();
        errorService.reportError(error, 'google-command-createCalendarEvent');
        
        context_map.error = error.message;
        context_map.error_solution = "I encountered an issue creating your calendar event. Please make sure you're connected to your Google account and try again.";
        
        return { context_map, stop: false };
    }
}

/**
 * List files from Google Drive
 * @param {Object} context_map - Context map from wit.ai
 * @returns {Promise<Object>} - Updated context_map with response or error
 */
async function listDriveFiles(context_map) {
    try {
        console.log("Listing Google Drive files");
        
        const googleService = await getGoogleService();
        const maxResults = context_map.max_results || 10; // Default to 10 or use specified value
        
        const result = await googleService.listDriveFiles(maxResults);
        
        // Check if there was an error
        if (!result.success && result.error) {
            context_map.error = result.error;
            context_map.error_solution = `I couldn't list your Drive files. ${
                !googleService.isAuthorized() 
                    ? "Please connect your Google account in settings." 
                    : "Please check your internet connection and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(result.error, 'google-command-listDriveFiles');
            
            return { context_map, stop: false };
        }
        
        // Store the files in context map
        context_map.drive_files = result.data;
        
        // Add a summary for response
        if (result.data.length === 0) {
            context_map.drive_summary = "You don't have any files in your Google Drive.";
        } else {
            context_map.drive_summary = `You have ${result.data.length} file${result.data.length > 1 ? 's' : ''} in your Google Drive.`;
        }
        
        return { context_map, stop: false };
    } catch (error) {
        // Handle any unexpected errors
        const errorService = getErrorService();
        errorService.reportError(error, 'google-command-listDriveFiles');
        
        context_map.error = error.message;
        context_map.error_solution = "I encountered an issue listing your Drive files. Please make sure you're connected to your Google account and try again.";
        
        return { context_map, stop: false };
    }
}

module.exports = {
    checkEmails,
    draftEmails,
    getCalendarEvents,
    createCalendarEvent,
    listDriveFiles
}; 