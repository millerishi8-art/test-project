import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import SignaturePad from '../components/SignaturePad';
import '../components/CreditAgreementSheet.css';
import './AdminPanel.css';
import './AdminStaffAgreements.css';

function cloneAgreement(agreement) {
  return JSON.parse(JSON.stringify(agreement));
}

function statusOf(agreement) {
  if (agreement?.locked) return { label: 'חתום ונעול', tone: 'locked' };
  if (agreement?.employerSignature || agreement?.employeeSignature) {
    return { label: 'ממתין לחתימה', tone: 'waiting' };
  }
  return { label: 'טיוטה לעריכה', tone: 'draft' };
}

function signedOn(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('he-IL');
}

function errorText(error, fallback) {
  return error?.response?.data?.error || fallback;
}

export default function AdminStaffAgreements() {
  const navigate = useNavigate();
  const [agreements, setAgreements] = useState([]);
  const [canEditText, setCanEditText] = useState(false);
  const [viewerEmail, setViewerEmail] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [employerInk, setEmployerInk] = useState('');
  const [employeeInk, setEmployeeInk] = useState('');

  const load = useCallback(async () => {
    const res = await axios.get('/admin/staff-agreements');
    const list = Array.isArray(res.data?.agreements) ? res.data.agreements : [];
    setAgreements(list);
    setCanEditText(res.data?.canEditText === true);
    setViewerEmail(String(res.data?.viewerEmail || '').toLowerCase());
    setSelectedEmail((current) => {
      if (current && list.some((item) => item.employeeEmail === current)) return current;
      if (list.length === 1) return list[0].employeeEmail;
      return '';
    });
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } catch (error) {
        if (alive) setLoadError(errorText(error, 'שגיאה בטעינת ההסכמים'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const selected = agreements.find((item) => item.employeeEmail === selectedEmail) || null;

  useEffect(() => {
    const next = agreements.find((item) => item.employeeEmail === selectedEmail) || null;
    setDraft(next ? cloneAgreement(next) : null);
    setEditing(false);
    setEmployerInk('');
    setEmployeeInk('');
    // רק במעבר בין עובדים. שמירה לא מחזירה את מצב העריכה.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmail]);

  const replaceAgreement = (next) => {
    setAgreements((list) => list.map((item) => (item.employeeEmail === next.employeeEmail ? next : item)));
    setDraft(cloneAgreement(next));
  };

  const saveText = async () => {
    if (!draft) return;
    setBusy(true);
    setNotice('');
    setLoadError('');
    try {
      const res = await axios.put(`/admin/staff-agreements/${encodeURIComponent(draft.employeeEmail)}`, {
        action: 'save-text',
        agreement: draft,
      });
      replaceAgreement(res.data.agreement);
      setEditing(false);
      const cleared =
        (selected?.employerSignature || selected?.employeeSignature) &&
        !res.data.agreement.employerSignature &&
        !res.data.agreement.employeeSignature;
      setNotice(cleared ? 'הנוסח נשמר. החתימות הקודמות נמחקו כי ההסכם השתנה, וצריך לחתום מחדש.' : 'ההסכם נשמר.');
    } catch (error) {
      setLoadError(errorText(error, 'שמירת ההסכם נכשלה'));
    } finally {
      setBusy(false);
    }
  };

  const sign = async (action, signature) => {
    if (!selected || !signature) return;
    setBusy(true);
    setNotice('');
    setLoadError('');
    try {
      const res = await axios.put(`/admin/staff-agreements/${encodeURIComponent(selected.employeeEmail)}`, {
        action,
        signature,
      });
      replaceAgreement(res.data.agreement);
      setNotice(res.data.agreement.locked ? 'שני הצדדים חתמו. ההסכם נשמר ונעול.' : 'החתימה נשמרה.');
    } catch (error) {
      setLoadError(errorText(error, 'שמירת החתימה נכשלה'));
    } finally {
      setBusy(false);
    }
  };

  const exceptionalEdit = async () => {
    if (!selected) return;
    const ok = window.confirm(
      'לפתוח את ההסכם החתום לעריכה? שתי החתימות יימחקו, ואחרי השמירה שני הצדדים יצטרכו לחתום מחדש.'
    );
    if (!ok) return;
    setBusy(true);
    setNotice('');
    setLoadError('');
    try {
      const res = await axios.put(`/admin/staff-agreements/${encodeURIComponent(selected.employeeEmail)}`, {
        action: 'exceptional-edit',
        agreement: selected,
      });
      replaceAgreement(res.data.agreement);
      setEditing(true);
      setNotice('ההסכם נפתח לעריכה חריגה. החתימות נמחקו.');
    } catch (error) {
      setLoadError(errorText(error, 'פתיחת ההסכם נכשלה'));
    } finally {
      setBusy(false);
    }
  };

  const updateDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const updateSection = (index, patch) => {
    setDraft((current) => {
      const sections = current.sections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, ...patch } : section
      );
      return { ...current, sections };
    });
  };

  const updateItem = (sectionIndex, itemIndex, value) => {
    setDraft((current) => {
      const sections = current.sections.map((section, index) => {
        if (index !== sectionIndex) return section;
        const items = section.items.map((item, i) => (i === itemIndex ? value : item));
        return { ...section, items };
      });
      return { ...current, sections };
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">טוען הסכמי עובדים...</div>
      </div>
    );
  }

  const showList = canEditText && !selected;
  const mine = viewerEmail && selected?.employeeEmail === viewerEmail;

  return (
    <div className="admin-panel-container staff-agreements-page">
      <div className="admin-header no-print">
        <h1>הסכם עובדים</h1>
        <p className="admin-welcome">
          {canEditText
            ? 'לכל עובד יש הסכם נפרד מול נעם. אפשר לערוך שכר וסעיפים עד ששני הצדדים חותמים. אחרי החתימה ההסכם נשמר ונעול, ואפשר לפתוח אותו רק במקרה חריג.'
            : 'מוצג רק ההסכם שלך מול נעם. אחרי ששני הצדדים חותמים, הנוסח נשמר ואינו ניתן לעריכה.'}
        </p>
        <div className="admin-header-actions">
          {selected && canEditText && (
            <button type="button" className="admin-staff-agreements-btn" onClick={() => setSelectedEmail('')}>
              כל העובדים
            </button>
          )}
          <button type="button" className="admin-case-processing-btn" onClick={() => navigate('/admin/staff')}>
            חזרה לעובדים
          </button>
        </div>
      </div>

      {notice && (
        <div className="admin-success-message no-print" role="status">
          {notice}
        </div>
      )}
      {loadError && (
        <div className="staff-error no-print" role="alert">
          {loadError}
        </div>
      )}

      {!selected && !showList && <p className="staff-empty">אין הסכם משויך לחשבון הזה.</p>}

      {showList && (
        <div className="staff-roster">
          {agreements.length === 0 ? (
            <p className="staff-empty">אין עובדים להצגה.</p>
          ) : (
            agreements.map((agreement) => {
              const status = statusOf(agreement);
              return (
                <button
                  key={agreement.employeeEmail}
                  type="button"
                  className="staff-roster-card"
                  onClick={() => setSelectedEmail(agreement.employeeEmail)}
                >
                  <span className="staff-initials" aria-hidden="true">
                    {agreement.initials}
                  </span>
                  <span>
                    <strong>{agreement.employeeName}</strong>
                    <small>{agreement.employeeEmail}</small>
                  </span>
                  <span className={`staff-status staff-status--${status.tone}`}>{status.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}

      {selected && draft && (
        <article className="staff-sheet">
          <header className="staff-sheet-head">
            <p className="staff-kicker">{draft.kicker || 'הסכם עבודה'}</p>
            <h2>{draft.title || 'הסכם שיתוף פעולה'}</h2>
            <p className="staff-date">
              {draft.employeeName} · {draft.employerName}
              {draft.dateLabel ? ` · ${draft.dateLabel}` : ''}
            </p>
            <p className={`staff-status staff-status--${statusOf(selected).tone} no-print`}>{statusOf(selected).label}</p>
          </header>

          {canEditText && !selected.locked && (
            <div className="staff-edit-bar no-print">
              {!editing ? (
                <button type="button" onClick={() => setEditing(true)} disabled={busy}>
                  עריכת הסכם
                </button>
              ) : (
                <>
                  <button type="button" onClick={saveText} disabled={busy}>
                    שמירת הנוסח
                  </button>
                  <button type="button" className="staff-quiet" onClick={() => setDraft(cloneAgreement(selected))} disabled={busy}>
                    ביטול
                  </button>
                </>
              )}
            </div>
          )}

          {canEditText && selected.locked && (
            <div className="staff-edit-bar no-print">
              <button type="button" onClick={exceptionalEdit} disabled={busy}>
                פתיחה חריגה לעריכה
              </button>
            </div>
          )}

          {editing ? (
            <div className="staff-editor no-print">
              <label>
                כותרת
                <input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} />
              </label>
              <label>
                תאריך
                <input
                  value={draft.dateLabel}
                  onChange={(event) => updateDraft({ dateLabel: event.target.value })}
                  placeholder="לדוגמה: 25 באוקטובר 2026"
                />
              </label>
              <label>
                שם העובד
                <input
                  value={draft.employeeName}
                  onChange={(event) => updateDraft({ employeeName: event.target.value })}
                />
              </label>
              <label>
                פתיח
                <textarea rows={4} value={draft.intro} onChange={(event) => updateDraft({ intro: event.target.value })} />
              </label>
              <div className="staff-id-row">
                <label>
                  תעודת זהות — נעם
                  <input value={draft.employerId} onChange={(event) => updateDraft({ employerId: event.target.value })} />
                </label>
                <label>
                  תעודת זהות — עובד
                  <input value={draft.employeeId} onChange={(event) => updateDraft({ employeeId: event.target.value })} />
                </label>
              </div>
              {draft.sections.map((section, sectionIndex) => (
                <fieldset key={`section-${sectionIndex}`} className="staff-section-edit">
                  <legend>סעיף {sectionIndex + 1}</legend>
                  <label>
                    כותרת הסעיף
                    <input
                      value={section.title}
                      onChange={(event) => updateSection(sectionIndex, { title: event.target.value })}
                    />
                  </label>
                  {section.items.map((item, itemIndex) => (
                    <label key={`item-${sectionIndex}-${itemIndex}`}>
                      שורה {itemIndex + 1}
                      <textarea
                        rows={3}
                        value={item}
                        onChange={(event) => updateItem(sectionIndex, itemIndex, event.target.value)}
                      />
                    </label>
                  ))}
                  <div className="staff-inline-actions">
                    <button
                      type="button"
                      className="staff-quiet"
                      onClick={() => updateSection(sectionIndex, { items: [...section.items, ''] })}
                    >
                      הוספת שורה
                    </button>
                    <button
                      type="button"
                      className="staff-quiet"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          sections: current.sections.filter((_, index) => index !== sectionIndex),
                        }))
                      }
                    >
                      מחיקת הסעיף
                    </button>
                  </div>
                </fieldset>
              ))}
              <button
                type="button"
                className="staff-quiet"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    sections: [...current.sections, { title: 'סעיף חדש.', items: [''] }],
                  }))
                }
              >
                הוספת סעיף
              </button>
            </div>
          ) : (
            <>
              {draft.intro && <p className="staff-intro">{draft.intro}</p>}
              <div className="staff-parties">
                <div>
                  <strong>{draft.employerName || 'נעם'}</strong>
                  <p>
                    {draft.employerName || 'נעם מילר'}
                    <br />
                    תעודת זהות {draft.employerId || '____________'}
                    <br />
                    להלן: «נעם»
                  </p>
                </div>
                <div>
                  <strong>{draft.employeeName}</strong>
                  <p>
                    {draft.employeeName}
                    <br />
                    תעודת זהות {draft.employeeId || '____________'}
                    <br />
                    להלן: «{draft.employeeName}»
                  </p>
                </div>
              </div>
              <ol className="staff-sections">
                {draft.sections.map((section, sectionIndex) => (
                  <li key={`view-${sectionIndex}`}>
                    <strong>{section.title}</strong>
                    {section.items.length > 1 ? (
                      <ol>
                        {section.items.map((item, itemIndex) => (
                          <li key={`view-item-${sectionIndex}-${itemIndex}`}>{item}</li>
                        ))}
                      </ol>
                    ) : (
                      section.items[0] && <span> {section.items[0]}</span>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}

          <p className="staff-witness">ולראיה באו הצדדים על החתום:</p>
          <div className="staff-signs">
            <div className="staff-sign-box">
              <div className="staff-who">{draft.employerName || 'נעם מילר'}</div>
              {selected.employerSignature ? (
                <img src={selected.employerSignature} alt={`חתימת ${draft.employerName || 'נעם'}`} />
              ) : canEditText && !selected.locked ? (
                <div className="no-print">
                  <SignaturePad ariaLabel="חתימת נעם" clearLabel="ניקוי חתימה" onChange={setEmployerInk} />
                  <button type="button" disabled={busy || !employerInk} onClick={() => sign('sign-employer', employerInk)}>
                    שמירת החתימה של נעם
                  </button>
                </div>
              ) : (
                <p className="staff-unsigned">ממתין לחתימת נעם</p>
              )}
              <div className="staff-sign-date">
                {signedOn(selected.employerSignedAt) ? `נחתם ב־${signedOn(selected.employerSignedAt)}` : 'תאריך ________________'}
              </div>
            </div>
            <div className="staff-sign-box">
              <div className="staff-who">{draft.employeeName}</div>
              {selected.employeeSignature ? (
                <img src={selected.employeeSignature} alt={`חתימת ${draft.employeeName}`} />
              ) : mine && !selected.locked ? (
                <div className="no-print">
                  <SignaturePad ariaLabel={`חתימת ${draft.employeeName}`} clearLabel="ניקוי חתימה" onChange={setEmployeeInk} />
                  <button type="button" disabled={busy || !employeeInk} onClick={() => sign('sign-employee', employeeInk)}>
                    שמירת החתימה שלי
                  </button>
                </div>
              ) : (
                <p className="staff-unsigned">ממתין לחתימת {draft.employeeName}</p>
              )}
              <div className="staff-sign-date">
                {signedOn(selected.employeeSignedAt) ? `נחתם ב־${signedOn(selected.employeeSignedAt)}` : 'תאריך ________________'}
              </div>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
