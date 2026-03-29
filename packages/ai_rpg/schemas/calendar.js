/**
 * Schema for calendar_generation responses.
 *
 * Parsed by parseCalendarDefinitionXml in api.js.  The <calendarDefinition>
 * root contains months, weekdays, seasons (with timeDescriptions), and
 * holidays.
 */

const { z } = require('zod');

// --- Time description (within a season) ---

const TimeDescriptionSchema = z.object({
    timeOfDay: z.number()
        .describe('Numeric time-of-day value (e.g. minutes past midnight)'),
    description: z.string()
        .describe('Narrative description of this time of day in this season'),
});

// --- Month ---

const MonthSchema = z.object({
    name: z.string().describe('Month name'),
    lengthDays: z.number().int().describe('Number of days in this month'),
    seasonName: z.string().nullable().describe('Associated season name, or null'),
});

// --- Season ---

const SeasonSchema = z.object({
    name: z.string().describe('Season name'),
    description: z.string().nullable().describe('Narrative description of the season'),
    startMonth: z.string().nullable().describe('Name of the month this season starts in'),
    startDay: z.number().int().describe('Day of the month the season starts (default 1)'),
    dayLengthMinutes: z.number().int().nullable()
        .describe('Length of daylight in minutes, or null'),
    timeDescriptions: z.array(TimeDescriptionSchema)
        .describe('Time-of-day descriptions for this season'),
});

// --- Holiday ---

const HolidaySchema = z.object({
    name: z.string().describe('Holiday name'),
    description: z.string().nullable().describe('Description of the holiday'),
    month: z.string().nullable().describe('Month the holiday falls in'),
    day: z.number().int().nullable().describe('Day of the month, or null'),
});

// --- Full calendar definition ---

const CalendarSchema = z.object({
    yearName: z.string().describe('Name for the year unit (e.g. "Common Era")'),
    months: z.array(MonthSchema).min(1).describe('Calendar months'),
    weekdays: z.array(z.string()).min(1).describe('Weekday names'),
    seasons: z.array(SeasonSchema).describe('Season definitions'),
    holidays: z.array(HolidaySchema).describe('Holiday definitions'),
});

module.exports = {
    TimeDescriptionSchema,
    MonthSchema,
    SeasonSchema,
    HolidaySchema,
    CalendarSchema,
};
