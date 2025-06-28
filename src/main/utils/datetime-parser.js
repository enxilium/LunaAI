/**
 * Datetime Parser Utility
 * Provides standardized functions for parsing datetime entities from wit.ai
 */

/**
 * Parse datetime entity from wit.ai into a standardized format
 * @param {Object|Array} datetimeEntity - Datetime entity or array from wit.ai
 * @returns {Object} - Parsed datetime information
 */
function parseDatetimeEntity(datetimeEntity) {
    // Handle missing or empty input
    if (!datetimeEntity) {
        const now = new Date();
        return {
            type: 'current',
            value: now,
            grain: 'day',
            timeMin: now.toISOString(),
            timeMax: null,
            description: 'today',
            body: 'today'
        };
    }

    // If an array is passed, use the first element
    const entity = Array.isArray(datetimeEntity) ? datetimeEntity[0] : datetimeEntity;
    
    // Store the original text for response formatting
    const originalText = entity.body || '';
    
    // Case 1: Interval type (from-to)
    if ((entity.type === 'interval' && entity.from && entity.to) || 
        (entity.values && entity.values[0] && 
         entity.values[0].type === 'interval' && 
         entity.values[0].from && 
         entity.values[0].to)) {
        
        const from = entity.from || (entity.values && entity.values[0].from);
        const to = entity.to || (entity.values && entity.values[0].to);
        
        const fromDate = new Date(from.value);
        const toDate = new Date(to.value);
        const grain = from.grain || 'day';
        
        return {
            type: 'interval',
            from: fromDate,
            to: toDate,
            grain: grain,
            timeMin: fromDate.toISOString(),
            timeMax: toDate.toISOString(),
            description: formatDateRangeDescription(fromDate, toDate),
            body: originalText
        };
    }
    
    // Case 2: Value type with grain
    if ((entity.type === 'value' && entity.value) || 
        (entity.values && entity.values[0] && 
         entity.values[0].type === 'value' && 
         entity.values[0].value)) {
        
        const grain = entity.grain || (entity.values && entity.values[0] && entity.values[0].grain) || 'day';
        const value = entity.value || (entity.values && entity.values[0] && entity.values[0].value);
        const date = new Date(value);
        
        // For a day grain, set timeMin to the start of the day and timeMax to the end of the day
        let timeMin, timeMax;
        if (grain === 'day') {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            
            timeMin = startOfDay.toISOString();
            timeMax = endOfDay.toISOString();
        } else {
            timeMin = date.toISOString();
            timeMax = null;
        }
        
        return {
            type: 'value',
            value: date,
            grain: grain,
            timeMin: timeMin,
            timeMax: timeMax,
            description: formatDateDescription(date, grain),
            body: originalText
        };
    }
    
    // Fallback to current time
    const now = new Date();
    return {
        type: 'current',
        value: now,
        grain: 'day',
        timeMin: now.toISOString(),
        timeMax: null,
        description: 'today',
        body: originalText || 'today'
    };
}

/**
 * Format a date range description
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {string} - Natural language description
 */
function formatDateRangeDescription(fromDate, toDate) {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    
    // Check if dates are on the same day
    if (fromDate.toDateString() === toDate.toDateString()) {
        return `on ${fromDate.toLocaleDateString('en-US', options)}`;
    }
    
    // Check if it's this weekend
    const now = new Date();
    const friday = new Date(now);
    friday.setDate(now.getDate() + (5 - now.getDay()));
    const monday = new Date(friday);
    monday.setDate(friday.getDate() + 3);
    
    if (fromDate >= friday && toDate <= monday) {
        return 'this weekend';
    }
    
    // Check if it's next week
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + (8 - now.getDay()));
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    
    if (fromDate >= nextMonday && toDate <= nextSunday) {
        return 'next week';
    }
    
    // Default to date range
    return `from ${fromDate.toLocaleDateString('en-US', options)} to ${toDate.toLocaleDateString('en-US', options)}`;
}

/**
 * Format a single date description based on grain
 * @param {Date} date - The date
 * @param {string} grain - The grain (day, week, month, etc.)
 * @returns {string} - Natural language description
 */
function formatDateDescription(date, grain) {
    const now = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    
    // Check if it's today
    if (date.toDateString() === now.toDateString()) {
        return 'today';
    }
    
    // Check if it's tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) {
        return 'tomorrow';
    }
    
    // Handle different grains
    switch (grain) {
        case 'week':
            // Check if it's next week
            const nextMonday = new Date(now);
            nextMonday.setDate(now.getDate() + (8 - now.getDay()));
            const nextSunday = new Date(nextMonday);
            nextSunday.setDate(nextMonday.getDate() + 6);
            
            if (date >= nextMonday && date <= nextSunday) {
                return 'next week';
            }
            break;
            
        case 'weekend':
            // Check if it's this weekend
            const friday = new Date(now);
            friday.setDate(now.getDate() + (5 - now.getDay()));
            const monday = new Date(friday);
            monday.setDate(friday.getDate() + 3);
            
            if (date >= friday && date <= monday) {
                return 'this weekend';
            }
            break;
    }
    
    // Default to formatted date
    return `on ${date.toLocaleDateString('en-US', options)}`;
}

/**
 * Parse datetime JSON from context_map for calendar events
 * @param {Object} context_map - Context map from wit.ai
 * @param {string} fieldName - Field name to look for (e.g., 'datetime_json' or 'event_date_json')
 * @returns {Object} - Object with timeMin and timeMax properties
 */
function parseCalendarDatetime(context_map, fieldName = 'datetime_json') {
    if (!context_map || !context_map[fieldName] || !context_map[fieldName].length) {
        // Default to current time if no datetime provided
        return {
            timeMin: new Date().toISOString(),
            timeMax: null,
            description: 'upcoming',
            body: null
        };
    }
    
    const parsed = parseDatetimeEntity(context_map[fieldName][0]);
    
    return {
        timeMin: parsed.timeMin,
        timeMax: parsed.timeMax,
        description: parsed.description,
        body: parsed.body
    };
}

/**
 * Parse event datetime for calendar event creation
 * @param {Object} context_map - Context map from wit.ai
 * @returns {Object} - Object with startDateTime, endDateTime, and text description
 */
function parseEventDatetime(context_map) {
    let startDateTime = null;
    let endDateTime = null;
    let description = null;
    const event_duration = context_map.event_duration || 60; // Default to 1 hour (60 minutes)
    
    // Parse event_date_json if present
    if (context_map.event_date_json && context_map.event_date_json.length > 0) {
        const parsed = parseDatetimeEntity(context_map.event_date_json[0]);
        description = parsed.body;
        
        if (parsed.type === 'interval') {
            startDateTime = parsed.from;
            endDateTime = parsed.to;
        } else {
            startDateTime = parsed.value;
            
            if (parsed.grain === 'day') {
                // For a day grain (all-day event), set start to beginning of day and end to end of day
                startDateTime.setHours(0, 0, 0, 0);
                endDateTime = new Date(startDateTime);
                endDateTime.setHours(23, 59, 59, 999);
            } else {
                // For specific times, use the duration parameter to calculate end
                endDateTime = new Date(startDateTime.getTime() + (event_duration * 60000));
            }
        }
    }
    // Legacy support for separate event_date and event_time
    else if (context_map.event_date) {
        startDateTime = new Date(context_map.event_date);
        
        // If time is specified, set it
        if (context_map.event_time) {
            description = `${context_map.event_date} at ${context_map.event_time}`;
            const [hours, minutes] = context_map.event_time.split(':').map(Number);
            startDateTime.setHours(hours || 0);
            startDateTime.setMinutes(minutes || 0);
        } else {
            description = context_map.event_date;
        }
        
        // Calculate end time based on duration
        endDateTime = new Date(startDateTime.getTime() + (event_duration * 60000));
    }
    
    return {
        startDateTime,
        endDateTime,
        description
    };
}

/**
 * Parse weather datetime from context_map
 * @param {Object} context_map - Context map from wit.ai
 * @returns {Object} - Parsed datetime information for weather
 */
function parseWeatherDatetime(context_map) {
    // Handle missing context_map
    if (!context_map) {
        const now = new Date();
        return {
            type: 'current',
            value: now,
            description: 'today'
        };
    }

    if (!context_map.date || !context_map.date[0]) {
        // If no date is provided, default to current time
        const now = new Date();
        return {
            type: 'current',
            value: now,
            description: 'today'
        };
    }
    
    return parseDatetimeEntity(context_map.date[0]);
}

module.exports = {
    parseDatetimeEntity,
    parseCalendarDatetime,
    parseEventDatetime,
    parseWeatherDatetime,
    formatDateDescription,
    formatDateRangeDescription
}; 