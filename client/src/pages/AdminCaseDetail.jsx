import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import './AdminCaseDetail.css';

const benefitTitles = {
  family: 'משפחה (כולל הורה וילדים מתחת לגיל 18)',
  individual: 'בגיר מעל 21',
  minor: 'צעיר',
  card_order: 'הזמנת כרטיס ($150)',
};

const cardIssueLabels = {
  none: 'בקשת כרטיס חדש / החלפה',
  stolen: 'דווח כגנוב',
  lost: 'דווח כנאבד',
  not_working: 'הגיע אבל לא עובד',
};

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'נשלח' },
  { value: 'pending', label: 'בתהליך / ממתין לאישור' },
  { value: 'approved', label: 'אושר – מחכים לאישור הממשלה' },
  { value: 'rejected', label: 'נדחה / נסגר' },
  { value: 'closed', label: 'נסגר' },
];

const adminCitizenshipLabels = {
  he: 'אזרחות נוספת (מדינה)',
  en: 'Additional citizenship (country)',
};

/** URL להצגה – תומך במחרוזת או באובייקט מהמסד (path/url) */
function mediaFieldToUrl(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') return String(val.path || val.url || val.data || '').trim();
  return '';
}

function urlLooksLikePdf(url) {
  if (!url || typeof url !== 'string') return false;
  return /\.pdf(\?|#|$)/i.test(url);
}

function normalizeAttachmentRows(caseData) {
  const meta = Array.isArray(caseData?.attachmentMeta) ? caseData.attachmentMeta : [];
  if (meta.length > 0) {
    return meta
      .map((m, idx) => ({
        id: `meta_${idx}`,
        category: String(m?.category || 'general'),
        url: mediaFieldToUrl(m?.path),
      }))
      .filter((r) => !!r.url);
  }
  const att = Array.isArray(caseData?.attachments) ? caseData.attachments : [];
  return att
    .map((a, idx) => ({
      id: `att_${idx}`,
      category: 'general',
      url: mediaFieldToUrl(a),
    }))
    .filter((r) => !!r.url);
}

function parseChildCategory(category) {
  const m = String(category || '').match(/^child_(.+)_(passport|ssn|medical|passportImage|ssnImage|medicalFormsImage)$/i);
  if (!m) return null;
  const rawType = String(m[2] || '');
  const type =
    rawType === 'passportImage'
      ? 'passport'
      : rawType === 'ssnImage'
        ? 'ssn'
        : rawType === 'medicalFormsImage'
          ? 'medical'
          : rawType;
  return { childId: m[1], type };
}

function parseSpouseDocType(category) {
  const v = String(category || '');
  if (v === 'spouse_passport' || v === 'spouse_passportImage') return 'passport';
  if (v === 'spouse_ssn' || v === 'spouse_ssnImage') return 'ssn';
  return null;
}

const AdminCaseDetail = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [confirmingCompleted, setConfirmingCompleted] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchCase = async () => {
      try {
        const res = await axios.get(`/admin/cases/${caseId}`);
        if (!cancelled) setCaseData(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.status === 404 ? 'תיק לא נמצא' : 'שגיאה בטעינת התיק');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchCase();
    return () => { cancelled = true; };
  }, [caseId]);

  const formatDate = (dateString) => {
    if (!dateString) return '–';
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    if (newStatus === caseData.status) return;
    setStatusSaving(true);
    try {
      const res = await axios.patch(`/admin/cases/${caseId}`, { status: newStatus });
      setCaseData((prev) => (prev && res.data.case ? { ...prev, ...res.data.case } : res.data.case || prev));
    } catch (err) {
      console.error(err);
    } finally {
      setStatusSaving(false);
    }
  };

  const handleConfirmCompleted = async () => {
    setConfirmingCompleted(true);
    try {
      const res = await axios.patch(`/admin/cases/${caseId}/confirm-completed`);
      setCaseData((prev) => (prev ? { ...prev, ...res.data.case } : res.data.case));
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmingCompleted(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-case-detail-loading">
        <div className="admin-case-detail-spinner">טוען פרטי טופס...</div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="admin-case-detail-container">
        <div className="admin-case-detail-card">
          <p className="admin-case-detail-error">{error || 'תיק לא נמצא'}</p>
          <button type="button" className="admin-case-detail-back" onClick={() => navigate('/admin')}>
            חזרה לפאנל הניהול
          </button>
        </div>
      </div>
    );
  }

  const c = caseData;
  const attachmentRows = normalizeAttachmentRows(c);
  const mainDocs = {
    birth: [],
    ssn: [],
    passport: [],
    marriage_certificate_us: [],
    payment: [],
    id_doc: [],
    card_photo: [],
    general: [],
  };
  const spouseDocs = { passport: [], ssn: [] };
  const childDocsById = new Map();
  attachmentRows.forEach((row) => {
    const childParsed = parseChildCategory(row.category);
    if (childParsed) {
      const prev = childDocsById.get(childParsed.childId) || { passport: [], ssn: [], medical: [] };
      prev[childParsed.type]?.push(row);
      childDocsById.set(childParsed.childId, prev);
      return;
    }
    const spouseType = parseSpouseDocType(row.category);
    if (spouseType) {
      spouseDocs[spouseType].push(row);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(mainDocs, row.category)) {
      mainDocs[row.category].push(row);
      return;
    }
    mainDocs.general.push(row);
  });
  const familyChildren = Array.isArray(c?.personalDetails?.familyChildren) ? c.personalDetails.familyChildren : [];

  const renderMediaCard = (row, label, idx) => {
    const key = `${row.id}_${idx}`;
    if (urlLooksLikePdf(row.url)) {
      return (
        <div key={key} className="admin-case-detail-attachment-card admin-case-detail-attachment-pdf">
          <a className="admin-case-detail-pdf-open-link" href={row.url} target="_blank" rel="noopener noreferrer">
            {label} – PDF
          </a>
        </div>
      );
    }
    return (
      <div key={key} className="admin-case-detail-img-wrap admin-case-detail-img-clickable" onClick={() => setEnlargedImage(row.url)}>
        <img src={row.url} alt={label} className="admin-case-detail-uploaded-img" />
      </div>
    );
  };

  const formatCitizenshipCountry = (code) => {
    if (!code || typeof code !== 'string') return '–';
    const loc = language === 'he' ? 'he-IL' : 'en-US';
    try {
      const name = new Intl.DisplayNames([loc], { type: 'region' }).of(code);
      return name ? `${name} (${code})` : code;
    } catch {
      return code;
    }
  };

  /** personalDetails נשמר כאובייקט (caseEmail, declarationsAccepted וכו') – לא ניתן לרנדר אובייקט ישירות ב-React */
  const renderPersonalDetailsContent = (pd) => {
    if (pd == null || pd === '') return '–';
    if (typeof pd === 'string') return pd;
    if (typeof pd !== 'object' || Array.isArray(pd)) return String(pd);

    if (pd.form === 'food_stamps_eligibility') {
      const dec = pd.declarationsAccepted;
      const rows = [
        ['שם מלא', pd.fullName],
        ['תאריך לידה', pd.dob],
        ['מקום לידה', pd.birthPlace],
        ['שם האב', pd.fatherName],
        ['שם האם', pd.motherName],
        ['מצב משפחתי', pd.maritalStatus],
        ['מספר נתמכים', pd.dependentsCount],
        ['אזרחות נוספת', pd.additionalCitizenship],
        ['מקרה קודם', pd.previousCase],
        ['תיק פעיל', pd.activeCase],
      ];
      return (
        <div className="admin-case-detail-pd-structured">
          <div className="admin-case-detail-grid">
            {rows
              .filter(([, val]) => val != null && String(val).trim() !== '')
              .map(([label, val]) => (
                <div key={label} className="admin-case-detail-field">
                  <span className="admin-case-detail-label">{label}</span>
                  <span className="admin-case-detail-value">{String(val)}</span>
                </div>
              ))}
          </div>
          {(pd.caseEmail || pd.casePassword) && (
            <div className="admin-case-detail-grid admin-case-detail-pd-portal">
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">אימייל (חשבון תיק)</span>
                <span className="admin-case-detail-value">{pd.caseEmail || '–'}</span>
              </div>
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">סיסמה (חשבון תיק)</span>
                <span className="admin-case-detail-value">{pd.casePassword || '–'}</span>
              </div>
            </div>
          )}
          {dec && typeof dec === 'object' && !Array.isArray(dec) && (
            <div className="admin-case-detail-grid admin-case-detail-pd-declarations">
              {['dec1', 'dec2', 'dec3', 'dec4'].map((k) => (
                <div key={k} className="admin-case-detail-field">
                  <span className="admin-case-detail-label">הצהרה {k.replace('dec', '')}</span>
                  <span className="admin-case-detail-value">
                    {dec[k] ? 'כן' : dec[k] == null ? '–' : 'לא'}
                  </span>
                </div>
              ))}
            </div>
          )}
          {pd.signatureLink ? (
            <div className="admin-case-detail-field admin-case-detail-field-block admin-case-detail-pd-signature-link">
              <span className="admin-case-detail-label">קישור חתימה / הפניה</span>
              <p className="admin-case-detail-value admin-case-detail-text">
                <a href={pd.signatureLink} target="_blank" rel="noopener noreferrer">
                  {pd.signatureLink}
                </a>
              </p>
            </div>
          ) : null}
        </div>
      );
    }

    return <pre className="admin-case-detail-json">{JSON.stringify(pd, null, 2)}</pre>;
  };

  return (
    <div className="admin-case-detail-container">
      {enlargedImage && (
        <div
          className="admin-case-detail-lightbox"
          onClick={() => setEnlargedImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="תצוגה מוגדלת של התמונה"
        >
          <button
            type="button"
            className="admin-case-detail-lightbox-close"
            onClick={() => setEnlargedImage(null)}
            aria-label="סגור"
          >
            ×
          </button>
          <img
            src={enlargedImage}
            alt="תצוגה מוגדלת"
            className="admin-case-detail-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <div className="admin-case-detail-card">
        <h1>פרטי טופס – תיק #{c.id.slice(0, 8)}</h1>
        <p className="admin-case-detail-sub">גישה כמנהל. כל הפרטים שנשלחו בטופס.</p>

        <section className="admin-case-detail-section">
          <h2>פרטי משלח</h2>
          <div className="admin-case-detail-grid">
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">שם</span>
              <span className="admin-case-detail-value">{c.userName}</span>
            </div>
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">אימייל</span>
              <span className="admin-case-detail-value">{c.userEmail}</span>
            </div>
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">טלפון</span>
              <span className="admin-case-detail-value">{c.userPhone}</span>
            </div>
          </div>
        </section>

        <section className="admin-case-detail-section">
          <h2>סיכום תיק</h2>
          <div className="admin-case-detail-grid">
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">סוג הטבה</span>
              <span className="admin-case-detail-value">{benefitTitles[c.benefitType] || c.benefitType}</span>
            </div>
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">תאריך יצירה</span>
              <span className="admin-case-detail-value">{formatDate(c.createdAt)}</span>
            </div>
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">תאריך חידוש</span>
              <span className="admin-case-detail-value">{formatDate(c.renewalDate)}</span>
            </div>
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">סטטוס (מה הלקוח רואה)</span>
              <select
                className="admin-case-detail-status-select"
                value={c.status || 'submitted'}
                onChange={handleStatusChange}
                disabled={statusSaving}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {statusSaving && <span className="admin-case-detail-saving">שומר...</span>}
            </div>
            {c.adminConfirmedCompleted && (
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">אושר הושלם</span>
                <span className="admin-case-detail-value">כן – הלקוח יראה "צריך חידוש" + תאריך</span>
              </div>
            )}
          </div>
        </section>

        {c.benefitType === 'card_order' && c.personalDetails?.cardOrder && (
          <section className="admin-case-detail-section">
            <h2>הזמנת כרטיס — פרטי השאלון</h2>
            <div className="admin-case-detail-grid">
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">שם מלא</span>
                <span className="admin-case-detail-value">{c.personalDetails.fullName || '–'}</span>
              </div>
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">טלפון</span>
                <span className="admin-case-detail-value">{c.personalDetails.phone || '–'}</span>
              </div>
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">עלות</span>
                <span className="admin-case-detail-value">${c.personalDetails.cardOrder.feeUsd || 150}</span>
              </div>
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">הכרטיס הגיע ליעד</span>
                <span className="admin-case-detail-value">
                  {c.personalDetails.cardOrder.cardReceivedByMail ? 'כן' : 'לא'}
                </span>
              </div>
              {c.personalDetails.cardOrder.cardReceivedByMail && (
                <>
                  <div className="admin-case-detail-field">
                    <span className="admin-case-detail-label">הכרטיס פעיל</span>
                    <span className="admin-case-detail-value">
                      {c.personalDetails.cardOrder.cardActive ? 'כן' : 'לא'}
                    </span>
                  </div>
                  <div className="admin-case-detail-field">
                    <span className="admin-case-detail-label">מצב הכרטיס</span>
                    <span className="admin-case-detail-value">
                      {cardIssueLabels[c.personalDetails.cardOrder.cardIssue] ||
                        c.personalDetails.cardOrder.cardIssue ||
                        '–'}
                    </span>
                  </div>
                  <div className="admin-case-detail-field">
                    <span className="admin-case-detail-label">צילום כרטיס הועלה</span>
                    <span className="admin-case-detail-value">
                      {c.personalDetails.cardOrder.hasCardPhoto ? 'כן' : 'לא'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        <section className="admin-case-detail-section">
          <h2>תוכן הטופס</h2>
          {c.benefitType !== 'card_order' && (
          <div className="admin-case-detail-field admin-case-detail-field-block">
            <span className="admin-case-detail-label">כתובת מגורים</span>
            <p className="admin-case-detail-value admin-case-detail-text">{c.address || '–'}</p>
          </div>
          )}
          {typeof c.personalDetails === 'object' &&
            c.personalDetails !== null &&
            c.personalDetails.form === 'food_stamps_eligibility' &&
            c.personalDetails.additionalCitizenship === 'Yes' &&
            String(c.personalDetails.additionalCitizenshipCountry || '').trim() !== '' && (
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">
                  {adminCitizenshipLabels[language] || adminCitizenshipLabels.he}
                </span>
                <span className="admin-case-detail-value">
                  {formatCitizenshipCountry(c.personalDetails.additionalCitizenshipCountry)}
                </span>
              </div>
            )}
          {c.familyBackground != null && String(c.familyBackground).trim() !== '' && (
            <div className="admin-case-detail-field admin-case-detail-field-block">
              <span className="admin-case-detail-label">רקע משפחתי</span>
              <p className="admin-case-detail-value admin-case-detail-text">{c.familyBackground}</p>
            </div>
          )}
          <div className="admin-case-detail-field admin-case-detail-field-block">
            <span className="admin-case-detail-label">פרטים נוספים</span>
            <div className="admin-case-detail-value admin-case-detail-text">
              {renderPersonalDetailsContent(c.personalDetails)}
            </div>
          </div>
          {typeof c.personalDetails === 'object' &&
            c.personalDetails !== null &&
            String(c.personalDetails?.spouse?.healthStatus || '').trim() !== '' && (
              <div className="admin-case-detail-field admin-case-detail-field-block">
                <span className="admin-case-detail-label">מצב בריאותי (בן/בת זוג)</span>
                <p className="admin-case-detail-value admin-case-detail-text">
                  {c.personalDetails.spouse.healthStatus}
                </p>
              </div>
            )}

          {(mediaFieldToUrl(c.idCardPhoto) ||
            mediaFieldToUrl(c.idCardAnnex) ||
            attachmentRows.length > 0 ||
            familyChildren.length > 0) && (
            <>
              <h3 className="admin-case-detail-images-heading">תמונות ומסמכים שהלקוח העלה</h3>
              {mediaFieldToUrl(c.idCardPhoto) && (
                <div className="admin-case-detail-field admin-case-detail-field-block">
                  <span className="admin-case-detail-label">תמונת תעודת זהות / מסמך</span>
                  {urlLooksLikePdf(mediaFieldToUrl(c.idCardPhoto)) ? (
                    <a
                      className="admin-case-detail-pdf-open-link"
                      href={mediaFieldToUrl(c.idCardPhoto)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      פתיחת PDF – תעודת זהות / מסמך
                    </a>
                  ) : (
                    <div
                      className="admin-case-detail-img-wrap admin-case-detail-img-clickable"
                      onClick={() => setEnlargedImage(mediaFieldToUrl(c.idCardPhoto))}
                    >
                      <img
                        src={mediaFieldToUrl(c.idCardPhoto)}
                        alt="תעודת זהות / מסמך"
                        className="admin-case-detail-uploaded-img"
                      />
                    </div>
                  )}
                </div>
              )}
              {mediaFieldToUrl(c.idCardAnnex) && (
                <div className="admin-case-detail-field admin-case-detail-field-block">
                  <span className="admin-case-detail-label">נספח למסמך</span>
                  {urlLooksLikePdf(mediaFieldToUrl(c.idCardAnnex)) ? (
                    <a
                      className="admin-case-detail-pdf-open-link"
                      href={mediaFieldToUrl(c.idCardAnnex)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      פתיחת PDF – נספח
                    </a>
                  ) : (
                    <div
                      className="admin-case-detail-img-wrap admin-case-detail-img-clickable"
                      onClick={() => setEnlargedImage(mediaFieldToUrl(c.idCardAnnex))}
                    >
                      <img
                        src={mediaFieldToUrl(c.idCardAnnex)}
                        alt="נספח למסמך"
                        className="admin-case-detail-uploaded-img"
                      />
                    </div>
                  )}
                </div>
              )}
              {(mainDocs.birth.length > 0 ||
                mainDocs.ssn.length > 0 ||
                mainDocs.passport.length > 0 ||
                mainDocs.marriage_certificate_us.length > 0 ||
                mainDocs.payment.length > 0 ||
                mainDocs.id_doc.length > 0 ||
                mainDocs.card_photo.length > 0 ||
                mainDocs.general.length > 0) && (
                <div className="admin-case-detail-field admin-case-detail-field-block">
                  <span className="admin-case-detail-label">מסמכים כלליים</span>
                  <div className="admin-case-detail-attachments">
                    {mainDocs.birth.map((r, i) => renderMediaCard(r, `תעודת לידה ${i + 1}`, i))}
                    {mainDocs.id_doc.map((r, i) =>
                      renderMediaCard(r, `זיהוי (דרכון/ת״ז/רישיון) ${i + 1}`, i)
                    )}
                    {mainDocs.ssn.map((r, i) => renderMediaCard(r, `כרטיס סושיאל ${i + 1}`, i))}
                    {mainDocs.passport.map((r, i) => renderMediaCard(r, `דרכון ${i + 1}`, i))}
                    {mainDocs.card_photo.map((r, i) => renderMediaCard(r, `צילום כרטיס ${i + 1}`, i))}
                    {mainDocs.marriage_certificate_us.map((r, i) =>
                      renderMediaCard(r, `תעודת נישואין ${i + 1}`, i)
                    )}
                    {mainDocs.payment.map((r, i) => renderMediaCard(r, `אישור תשלום ${i + 1}`, i))}
                    {mainDocs.general.map((r, i) => renderMediaCard(r, `מסמך כללי ${i + 1}`, i))}
                  </div>
                </div>
              )}
              {(spouseDocs.passport.length > 0 || spouseDocs.ssn.length > 0) && (
                <div className="admin-case-detail-field admin-case-detail-field-block">
                  <span className="admin-case-detail-label">מסמכי בן/בת זוג</span>
                  <div className="admin-case-detail-attachments">
                    {spouseDocs.passport.map((r, i) => renderMediaCard(r, `דרכון בן/בת זוג ${i + 1}`, i))}
                    {spouseDocs.ssn.map((r, i) => renderMediaCard(r, `סושיאל בן/בת זוג ${i + 1}`, i))}
                  </div>
                </div>
              )}
              {familyChildren.length > 0 && (
                <div className="admin-case-detail-field admin-case-detail-field-block">
                  <span className="admin-case-detail-label">ילדים ומסמכים משויכים</span>
                  <div className="admin-case-detail-children-cards">
                    {familyChildren.map((child, idx) => {
                      const docs = childDocsById.get(String(child?.id || '')) || { passport: [], ssn: [], medical: [] };
                      return (
                        <article key={child.id || idx} className="admin-case-detail-child-card">
                          <h4 className="admin-case-detail-child-title">ילד #{idx + 1}</h4>
                          <div className="admin-case-detail-grid">
                            <div className="admin-case-detail-field">
                              <span className="admin-case-detail-label">תאריך לידה</span>
                              <span className="admin-case-detail-value">{child?.dob || '–'}</span>
                            </div>
                            <div className="admin-case-detail-field">
                              <span className="admin-case-detail-label">גיל</span>
                              <span className="admin-case-detail-value">{child?.age || '–'}</span>
                            </div>
                            <div className="admin-case-detail-field">
                              <span className="admin-case-detail-label">כיתה</span>
                              <span className="admin-case-detail-value">{child?.schoolClass || '–'}</span>
                            </div>
                          </div>
                          {String(child?.medicalIssues || '').trim() !== '' && (
                            <div className="admin-case-detail-field admin-case-detail-field-block">
                              <span className="admin-case-detail-label">מצב/מידע רפואי</span>
                              <p className="admin-case-detail-value admin-case-detail-text">{child.medicalIssues}</p>
                            </div>
                          )}
                          <div className="admin-case-detail-attachments">
                            {docs.passport.map((r, i) => renderMediaCard(r, `דרכון ילד ${idx + 1} - ${i + 1}`, i))}
                            {docs.ssn.map((r, i) => renderMediaCard(r, `סושיאל ילד ${idx + 1} - ${i + 1}`, i))}
                            {docs.medical.map((r, i) => renderMediaCard(r, `מסמך רפואי ילד ${idx + 1} - ${i + 1}`, i))}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {(c.signatoryName || mediaFieldToUrl(c.signatureImage)) && (
          <section className="admin-case-detail-section">
            <h2>אישור וחתימה</h2>
            {c.signatoryName && (
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">שם החותם</span>
                <span className="admin-case-detail-value">{c.signatoryName}</span>
              </div>
            )}
            {c.signedAt && (
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">תאריך חתימה</span>
                <span className="admin-case-detail-value">{formatDate(c.signedAt)}</span>
              </div>
            )}
            {mediaFieldToUrl(c.signatureImage) && (
              <div className="admin-case-detail-field admin-case-detail-field-block">
                <span className="admin-case-detail-label">חתימה (תמונה שהלקוח העלה)</span>
                <div
                  className="admin-case-detail-signature-img-wrap admin-case-detail-img-clickable"
                  onClick={() => setEnlargedImage(mediaFieldToUrl(c.signatureImage))}
                >
                  <img
                    src={mediaFieldToUrl(c.signatureImage)}
                    alt="חתימה"
                    className="admin-case-detail-signature-img"
                  />
                </div>
              </div>
            )}
          </section>
        )}

        <div className="admin-case-detail-actions">
          {!c.adminConfirmedCompleted && (
            <button
              type="button"
              className="admin-confirm-completed-btn"
              onClick={handleConfirmCompleted}
              disabled={confirmingCompleted}
            >
              {confirmingCompleted ? 'מאשר...' : 'אישור הושלם (צריך חידוש בעוד חצי שנה)'}
            </button>
          )}
          <button type="button" className="admin-case-detail-back" onClick={() => navigate('/admin')}>
            חזרה לפאנל הניהול
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminCaseDetail;
