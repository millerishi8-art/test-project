/**
 * Builds a Google Calendar "Add event" URL (action=TEMPLATE).
 * Opens in browser to add an event with the given title, date range, and details.
 *
 * @param {Object} opts
 * @param {string} opts.title - Event title (e.g. "חידוש קייס - תזכורת")
 * @param {Date} opts.startDate - Start date/time
 * @param {Date} [opts.endDate] - End date/time (default: 1 hour after start)
 * @param {string} [opts.details] - Event description
 * @param {string} [opts.location] - Event location
 * @returns {string} Full URL to open in new tab
 */
export function buildGoogleCalendarUrl({ title, startDate, endDate, details = '', location = '' }) {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const formatForGoogle = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return `${y}${m}${day}T${h}${min}${sec}`;
  };
  const start = formatForGoogle(startDate);
  const end = endDate ? formatForGoogle(endDate) : formatForGoogle(new Date(startDate.getTime() + 60 * 60 * 1000));
  const params = new URLSearchParams({
    text: title,
    dates: `${start}/${end}`,
    details: details,
    location: location,
  });
  return `${base}&${params.toString()}`;
}

/**
 * Opens the Google Calendar add-event page in a new tab (with noopener/noreferrer).
 * @param {string} url - URL from buildGoogleCalendarUrl
 */
export function openGoogleCalendarInNewTab(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
