import './RenewalReminderBanner.css';

/**
 * Yellow reminder banner with title, text, and a button to add renewal to Google Calendar.
 * @param {Object} props
 * @param {string} props.title - Banner title (e.g. "⚠️ תזכורת חשובה")
 * @param {string} props.text - Body text
 * @param {string} props.buttonLabel - Label for the calendar button
 * @param {() => void} props.onAddToCalendar - Called when user clicks the calendar button
 */
export default function RenewalReminderBanner({ title, text, buttonLabel, onAddToCalendar }) {
  return (
    <div className="renewal-reminder-banner" role="alert">
      <h3 className="renewal-reminder-banner-title">{title}</h3>
      <p className="renewal-reminder-banner-text">{text}</p>
      <button
        type="button"
        className="renewal-reminder-banner-btn"
        onClick={onAddToCalendar}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
