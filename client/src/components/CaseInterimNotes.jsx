import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { MessageSquare } from 'lucide-react';
import './CaseInterimNotes.css';

export function normalizeInterimNotes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((n) => n && typeof n === 'object' && String(n.text || '').trim());
}

export function getLastInterimNote(notes) {
  const list = normalizeInterimNotes(notes);
  if (list.length === 0) return null;
  return [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
}

function formatNoteDate(dateString) {
  if (!dateString) return '–';
  return new Date(dateString).toLocaleString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * כפתור אייקון בעמודת פעולות + Modal להערות ביניים.
 * עיצוב תואם למפרט Tailwind (gray-400 / blue-600 + badge) בתוך CSS של הפרויקט.
 */
export function CaseInterimNotesButton({
  caseId,
  caseLabel = '',
  notes: notesProp = [],
  onNotesChange,
}) {
  const [open, setOpen] = useState(false);
  const notes = useMemo(() => normalizeInterimNotes(notesProp), [notesProp]);
  const count = notes.length;
  const lastNote = getLastInterimNote(notes);
  const preview = lastNote
    ? `${lastNote.authorName || 'צוות'}: ${String(lastNote.text).slice(0, 120)}${
        String(lastNote.text).length > 120 ? '…' : ''
      }`
    : 'אין הערות ביניים עדיין – לחץ להוספה';

  return (
    <>
      <div className="case-notes-btn-wrap">
        <button
          type="button"
          className={`case-notes-icon-btn ${count > 0 ? 'has-notes' : 'no-notes'}`}
          onClick={() => setOpen(true)}
          aria-label={count > 0 ? `הערות ביניים (${count})` : 'הערות ביניים'}
          title={preview}
        >
          <MessageSquare size={18} strokeWidth={2.25} aria-hidden="true" />
          {count > 0 ? <span className="case-notes-badge">{count > 99 ? '99+' : count}</span> : null}
        </button>
        <span className="case-notes-tooltip" role="tooltip">
          {preview}
        </span>
      </div>

      {open ? (
        <CaseInterimNotesModal
          caseId={caseId}
          caseLabel={caseLabel}
          initialNotes={notes}
          onClose={() => setOpen(false)}
          onNotesChange={onNotesChange}
        />
      ) : null}
    </>
  );
}

export function CaseInterimNotesModal({ caseId, caseLabel, initialNotes = [], onClose, onNotesChange }) {
  const [notes, setNotes] = useState(() => normalizeInterimNotes(initialNotes));
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNotes(normalizeInterimNotes(initialNotes));
  }, [initialNotes, caseId]);

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [notes]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await axios.post(`/admin/cases/${caseId}/notes`, { text: trimmed });
      const nextNotes = normalizeInterimNotes(res.data?.interimNotes);
      const optimistic =
        nextNotes.length > 0
          ? nextNotes
          : [res.data?.note, ...notes].filter(Boolean);
      setNotes(optimistic);
      setText('');
      onNotesChange?.(caseId, optimistic);
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בשמירת ההערה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="case-notes-overlay" role="dialog" aria-modal="true" dir="rtl" onClick={onClose}>
      <div className="case-notes-modal" onClick={(ev) => ev.stopPropagation()}>
        <header className="case-notes-modal-header">
          <div>
            <h2>הערות ביניים</h2>
            {caseLabel ? <p className="case-notes-modal-sub">{caseLabel}</p> : null}
          </div>
          <button type="button" className="case-notes-close" onClick={onClose} aria-label="סגור">
            ×
          </button>
        </header>

        <div className="case-notes-history">
          {sortedNotes.length === 0 ? (
            <p className="case-notes-empty">עדיין אין הערות לתיק זה.</p>
          ) : (
            sortedNotes.map((note) => (
              <article key={note.id || `${note.createdAt}_${note.text}`} className="case-notes-item">
                <div className="case-notes-item-meta">
                  <strong>{note.authorName || note.authorEmail || 'צוות'}</strong>
                  <time dateTime={note.createdAt || undefined}>{formatNoteDate(note.createdAt)}</time>
                </div>
                <p className="case-notes-item-text">{note.text}</p>
              </article>
            ))
          )}
        </div>

        <form className="case-notes-compose" onSubmit={handleSubmit}>
          <label className="case-notes-label" htmlFor={`case-note-${caseId}`}>
            הוספת הערה חדשה
          </label>
          <textarea
            id={`case-note-${caseId}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="כתוב כאן עדכון ביניים לצוות..."
            dir="rtl"
            maxLength={4000}
          />
          {error ? <p className="case-notes-error">{error}</p> : null}
          <div className="case-notes-actions">
            <button type="button" className="case-notes-btn secondary" onClick={onClose} disabled={saving}>
              סגור
            </button>
            <button type="submit" className="case-notes-btn primary" disabled={saving || !text.trim()}>
              {saving ? 'שולח...' : 'שלח הערה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CaseInterimNotesButton;
