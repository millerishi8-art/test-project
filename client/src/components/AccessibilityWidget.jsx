import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './AccessibilityWidget.css';

const STORAGE_KEY = 'a11y-settings';
const MAX_FONT_STEP = 3;

const DEFAULT_SETTINGS = {
  fontStep: 0,
  contrast: false,
  grayscale: false,
  highlightLinks: false,
  readableFont: false,
  noMotion: false,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** מחיל את ההגדרות כמחלקות על <html> כך שישפיעו על כל האתר */
function applySettings(s) {
  const el = document.documentElement;
  el.classList.remove('a11y-font-1', 'a11y-font-2', 'a11y-font-3');
  if (s.fontStep > 0) el.classList.add(`a11y-font-${Math.min(s.fontStep, MAX_FONT_STEP)}`);
  el.classList.toggle('a11y-contrast', s.contrast);
  el.classList.toggle('a11y-grayscale', s.grayscale);
  el.classList.toggle('a11y-links', s.highlightLinks);
  el.classList.toggle('a11y-readable-font', s.readableFont);
  el.classList.toggle('a11y-no-motion', s.noMotion);
}

/** סמל נגישות אוניברסלי */
function AccessibilityIcon({ size = 30 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M12 2a2 2 0 110 4 2 2 0 010-4zm9 6.5c.3 0 .5.2.5.5s-.2.5-.5.5c-2.1.2-4.3.4-6.5.5l.3 4.4 2.2 6.2a.75.75 0 01-1.4.5l-2.1-5.9h-.9l-2.1 5.9a.75.75 0 01-1.4-.5l2.2-6.2.3-4.4c-2.2-.1-4.4-.3-6.5-.5a.5.5 0 010-1h.1c2.7.3 5.5.5 8.3.5s5.6-.2 8.3-.5h.2z" />
      <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(loadSettings);
  const panelRef = useRef(null);
  const toggleBtnRef = useRef(null);

  useEffect(() => {
    applySettings(settings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* אחסון לא זמין – ההגדרות יחולו רק לסשן הנוכחי */
    }
  }, [settings]);

  const closePanel = useCallback(() => {
    setOpen(false);
    toggleBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closePanel();
    };
    const onClickOutside = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open, closePanel]);

  const toggle = (key) => setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const changeFont = (delta) =>
    setSettings((prev) => ({
      ...prev,
      fontStep: Math.min(MAX_FONT_STEP, Math.max(0, prev.fontStep + delta)),
    }));

  const resetAll = () => setSettings({ ...DEFAULT_SETTINGS });

  const activeCount =
    (settings.fontStep > 0 ? 1 : 0) +
    ['contrast', 'grayscale', 'highlightLinks', 'readableFont', 'noMotion'].filter(
      (k) => settings[k]
    ).length;

  return (
    <div className="a11y-widget" dir="rtl">
      <button
        type="button"
        ref={toggleBtnRef}
        className="a11y-toggle-btn"
        aria-label={open ? 'סגור תפריט נגישות' : 'פתח תפריט נגישות'}
        aria-expanded={open}
        aria-controls="a11y-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <AccessibilityIcon />
        {activeCount > 0 && (
          <span className="a11y-active-badge" aria-hidden>
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id="a11y-panel"
          className="a11y-panel"
          role="dialog"
          aria-label="תפריט נגישות"
          ref={panelRef}
        >
          <div className="a11y-panel-header">
            <h2 className="a11y-panel-title">תפריט נגישות</h2>
            <button
              type="button"
              className="a11y-close-btn"
              onClick={closePanel}
              aria-label="סגור תפריט נגישות"
            >
              ✕
            </button>
          </div>

          <div className="a11y-font-row">
            <span className="a11y-font-label">גודל טקסט</span>
            <div className="a11y-font-controls">
              <button
                type="button"
                className="a11y-font-btn"
                onClick={() => changeFont(-1)}
                disabled={settings.fontStep === 0}
                aria-label="הקטן טקסט"
              >
                א-
              </button>
              <span className="a11y-font-step" aria-live="polite">
                {settings.fontStep === 0 ? 'רגיל' : `+${settings.fontStep}`}
              </span>
              <button
                type="button"
                className="a11y-font-btn"
                onClick={() => changeFont(1)}
                disabled={settings.fontStep === MAX_FONT_STEP}
                aria-label="הגדל טקסט"
              >
                א+
              </button>
            </div>
          </div>

          <div className="a11y-options">
            <button
              type="button"
              className={`a11y-option-btn ${settings.contrast ? 'active' : ''}`}
              aria-pressed={settings.contrast}
              onClick={() => toggle('contrast')}
            >
              <span className="a11y-option-icon" aria-hidden>◐</span>
              ניגודיות כהה
            </button>
            <button
              type="button"
              className={`a11y-option-btn ${settings.grayscale ? 'active' : ''}`}
              aria-pressed={settings.grayscale}
              onClick={() => toggle('grayscale')}
            >
              <span className="a11y-option-icon" aria-hidden>▩</span>
              גווני אפור
            </button>
            <button
              type="button"
              className={`a11y-option-btn ${settings.highlightLinks ? 'active' : ''}`}
              aria-pressed={settings.highlightLinks}
              onClick={() => toggle('highlightLinks')}
            >
              <span className="a11y-option-icon" aria-hidden>🔗</span>
              הדגשת קישורים
            </button>
            <button
              type="button"
              className={`a11y-option-btn ${settings.readableFont ? 'active' : ''}`}
              aria-pressed={settings.readableFont}
              onClick={() => toggle('readableFont')}
            >
              <span className="a11y-option-icon" aria-hidden>אב</span>
              גופן קריא
            </button>
            <button
              type="button"
              className={`a11y-option-btn ${settings.noMotion ? 'active' : ''}`}
              aria-pressed={settings.noMotion}
              onClick={() => toggle('noMotion')}
            >
              <span className="a11y-option-icon" aria-hidden>⏸</span>
              עצירת אנימציות
            </button>
          </div>

          <div className="a11y-panel-footer">
            <button type="button" className="a11y-reset-btn" onClick={resetAll}>
              איפוס הגדרות
            </button>
            <Link to="/accessibility" className="a11y-statement-link" onClick={closePanel}>
              הצהרת נגישות
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
