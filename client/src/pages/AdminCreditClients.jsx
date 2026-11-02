import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CreditAgreementSheet from '../components/CreditAgreementSheet.jsx';
import { idDocLabel } from '../data/creditAgreement';
import './AdminPanel.css';

function attachmentLabel(category, idDocType) {
  if (category === 'ssn') return 'סושיאל סקיוריטי';
  if (category === 'id_doc') return idDocLabel(idDocType) || 'מסמך זיהוי';
  return 'מסמך מצורף';
}

function looksLikePdf(url) {
  return /\.pdf($|\?)/i.test(String(url || ''));
}

function formatDate(dateString) {
  if (!dateString) return '–';
  return new Date(dateString).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

const AdminCreditClients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [enlargedImage, setEnlargedImage] = useState(null);

  const loadClients = async () => {
    setError('');
    try {
      const res = await axios.get('/admin/credit-clients');
      setClients(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setClients([]);
      setError(
        err.response?.status === 403
          ? 'הגישה ללקוחות אשראי שמורה למנהל הראשי וליוד גרונברג.'
          : err.response?.data?.error || 'שגיאה בטעינת לקוחות האשראי'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const removeClient = async (client) => {
    const name = client.personalDetails?.fullName || client.userName || 'הלקוח';
    if (!window.confirm(`להסיר את ${name} מרשימת לקוחות האשראי?\n\nההסכם והמסמכים יימחקו מהרשימה הזו.`)) {
      return;
    }
    setDeletingId(client.id);
    try {
      await axios.delete(`/admin/cases/${client.id}`);
      setClients((prev) => prev.filter((item) => item.id !== client.id));
    } catch (err) {
      window.alert(err.response?.data?.error || 'ההסרה נכשלה');
    } finally {
      setDeletingId(null);
    }
  };

  const withFiles = clients.filter((client) => {
    const meta = Array.isArray(client.attachmentMeta) ? client.attachmentMeta : [];
    return meta.some((item) => typeof item?.path === 'string' && item.path);
  }).length;

  return (
    <div className="admin-panel-container">
      <div className="admin-header">
        <h1>לקוחות אשראי</h1>
        <p className="admin-welcome">
          הסכמי מסגרת אשראי בלבד. הרשימה הזו נפרדת מקייסי הביטוח וממסך «עובדים לך על הכייס».
        </p>
        <p className="admin-sub">אין כאן חידוש לחצי שנה. הגישה שמורה למנהל הראשי וליוד גרונברג.</p>
        <div className="admin-header-actions">
          <button type="button" className="admin-case-processing-btn" onClick={() => navigate('/admin')}>
            חזרה לפאנל הניהול
          </button>
        </div>
      </div>

      {error ? (
        <div className="admin-load-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="admin-stats">
        <div className="stat-card">
          <h3>לקוחות אשראי</h3>
          <p className="stat-number">{clients.length}</p>
        </div>
        <div className="stat-card stat-info">
          <h3>עם מסמכים מצורפים</h3>
          <p className="stat-number">{withFiles}</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner">טוען לקוחות אשראי...</div>
        </div>
      ) : clients.length === 0 && !error ? (
        <div className="admin-table-container">
          <p className="empty-state">עדיין אין לקוחות שנרשמו דרך קוביית האשראי.</p>
        </div>
      ) : (
        <div className="admin-credit-clients">
          {clients.map((client) => {
            const images = (Array.isArray(client.attachmentMeta) ? client.attachmentMeta : [])
              .map((item) => ({
                url: typeof item?.path === 'string' ? item.path : '',
                label: attachmentLabel(item?.category, client.personalDetails?.idDocType),
              }))
              .filter((item) => item.url);
            const ssnNumber =
              client.personalDetails?.ssnMode === 'number' ? client.personalDetails?.ssnNumber : '';
            return (
              <article key={client.id} className="admin-credit-client-card">
                <header className="admin-credit-client-head">
                  <h2>{client.personalDetails?.fullName || client.userName}</h2>
                  <p>
                    {client.userEmail} · {client.userPhone} · נרשם {formatDate(client.createdAt)}
                  </p>
                  <button
                    type="button"
                    className="admin-remove-btn"
                    onClick={() => removeClient(client)}
                    disabled={deletingId !== null}
                  >
                    {deletingId === client.id ? 'מסיר...' : 'הסר לקוח אשראי'}
                  </button>
                </header>
                <CreditAgreementSheet
                  readOnly
                  clientName={client.personalDetails?.fullName || client.signatoryName || ''}
                  signDate={client.personalDetails?.signDate || ''}
                  clientSignatureUrl={client.signatureImage || ''}
                  agentSignatureUrl={client.agentSignatureImage || ''}
                />
                <div className="admin-credit-client-files">
                  <h3>מסמכים שצורפו</h3>
                  {ssnNumber ? <p className="admin-credit-ssn-number">סושיאל סקיוריטי: {ssnNumber}</p> : null}
                  {images.length === 0 ? (
                    <p className="admin-credit-no-images">לא צורפו תמונות ללקוח זה.</p>
                  ) : (
                    <div className="admin-credit-image-grid">
                      {images.map((image, index) =>
                        looksLikePdf(image.url) ? (
                          <a
                            key={`${image.url}-${index}`}
                            className="admin-credit-file-link"
                            href={image.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {image.label}
                          </a>
                        ) : (
                          <button
                            key={`${image.url}-${index}`}
                            type="button"
                            className="admin-credit-image-btn"
                            onClick={() => setEnlargedImage(image.url)}
                          >
                            <img src={image.url} alt={image.label} />
                            <span>{image.label}</span>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {enlargedImage ? (
        <div
          className="admin-credit-lightbox"
          onClick={() => setEnlargedImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="תצוגה מוגדלת של התמונה"
        >
          <button type="button" onClick={() => setEnlargedImage(null)} aria-label="סגור">
            ×
          </button>
          <img src={enlargedImage} alt="תצוגה מוגדלת" onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </div>
  );
};

export default AdminCreditClients;
