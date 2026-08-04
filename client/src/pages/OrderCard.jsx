import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { orderCardTranslations } from '../translations/orderCard';
import { compressImageFile } from '../utils/imageCompression';
import './OrderCard.css';

const ISSUE_OPTIONS = ['none', 'stolen', 'lost', 'not_working'];

const OrderCard = () => {
  const navigate = useNavigate();
  const { language, toggleLanguage } = useLanguage();
  const { token } = useAuth();
  const t = orderCardTranslations[language];

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cardReceived, setCardReceived] = useState(null); // 'yes' | 'no' | null
  const [cardActive, setCardActive] = useState(null);
  const [cardIssue, setCardIssue] = useState('');
  const [files, setFiles] = useState({
    id_doc: null,
    ssn: null,
    payment: null,
    card_photo: null,
  });
  const [previews, setPreviews] = useState({});
  const [pendingUploads, setPendingUploads] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const inputsRef = useRef({});

  const needsCardFollowUp = cardReceived === 'yes';
  const cardPhotoRequired =
    needsCardFollowUp && (cardIssue === 'stolen' || cardIssue === 'lost' || cardIssue === 'not_working');

  const clearFieldError = (key) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const uploadFile = async (file, category) => {
    if (!token) throw new Error(t.errorLogin);
    const data = await compressImageFile(file);
    const response = await axios.post(
      '/cases/upload-attachment',
      { data, category, fileName: file?.name || 'file' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return { path: response?.data?.path || '', preview: data };
  };

  const handleFilePick = (category) => async (e) => {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return;

    setPendingUploads((n) => n + 1);
    setError('');
    try {
      const { path, preview } = await uploadFile(file, category);
      setFiles((prev) => ({ ...prev, [category]: path }));
      setPreviews((prev) => ({ ...prev, [category]: preview }));
      clearFieldError(category);
    } catch {
      setError(t.errorUpload);
    } finally {
      setPendingUploads((n) => Math.max(0, n - 1));
    }
  };

  const removeFile = (category) => {
    setFiles((prev) => ({ ...prev, [category]: null }));
    setPreviews((prev) => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
  };

  const validate = () => {
    const errs = {};
    if (!fullName.trim()) errs.fullName = t.errorName;
    if (cardReceived !== 'yes' && cardReceived !== 'no') errs.cardReceived = t.errorReceived;
    if (needsCardFollowUp) {
      if (cardActive !== 'yes' && cardActive !== 'no') errs.cardActive = t.errorActive;
      if (!ISSUE_OPTIONS.includes(cardIssue)) errs.cardIssue = t.errorIssue;
      if (cardPhotoRequired && !files.card_photo) errs.card_photo = t.errorCardPhoto;
    }
    if (!files.id_doc) errs.id_doc = t.errorId;
    if (!files.ssn) errs.ssn = t.errorSsn;
    if (!files.payment) errs.payment = t.errorPayment;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (pendingUploads > 0) {
      setError(t.errorPending);
      return;
    }
    if (!validate()) return;
    if (!token) {
      setError(t.errorLogin);
      return;
    }

    setSubmitting(true);
    try {
      const attachments = [
        { category: 'id_doc', data: files.id_doc },
        { category: 'ssn', data: files.ssn },
        { category: 'payment', data: files.payment },
      ];
      if (files.card_photo) {
        attachments.push({ category: 'card_photo', data: files.card_photo });
      }

      await axios.post(
        '/cases/card-order',
        {
          fullName: fullName.trim(),
          phone: phone.trim(),
          cardReceivedByMail: cardReceived === 'yes',
          cardActive: needsCardFollowUp ? cardActive === 'yes' : null,
          cardIssue: needsCardFollowUp ? cardIssue : null,
          attachments,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate('/confirmation', { state: { benefitType: 'card_order' } });
    } catch (err) {
      setError(err.response?.data?.error || t.errorSubmit);
    } finally {
      setSubmitting(false);
    }
  };

  const renderUpload = (category, label, hint, required = true) => {
    const path = files[category];
    const preview = previews[category];
    const isPdf = typeof preview === 'string' && preview.startsWith('data:application/pdf');

    return (
      <div className={`order-card-upload ${fieldErrors[category] ? 'has-error' : ''}`}>
        <div className="order-card-upload-head">
          <strong>
            {label}
            {!required && language === 'he' ? ' (אופציונלי)' : !required ? ' (optional)' : ''}
          </strong>
          <span className="order-card-upload-hint">{hint}</span>
        </div>
        <input
          ref={(el) => {
            inputsRef.current[category] = el;
          }}
          type="file"
          accept="image/*,.pdf,application/pdf"
          hidden
          onChange={handleFilePick(category)}
        />
        <div className="order-card-upload-actions">
          <button
            type="button"
            className="order-card-file-btn"
            onClick={() => inputsRef.current[category]?.click()}
            disabled={pendingUploads > 0 && !path}
          >
            {pendingUploads > 0 && !path ? t.uploading : t.chooseFile}
          </button>
          {path && (
            <button type="button" className="order-card-remove-btn" onClick={() => removeFile(category)}>
              {t.removeFile}
            </button>
          )}
        </div>
        {path && (
          <div className="order-card-preview">
            {preview && !isPdf ? (
              <img src={preview} alt="" />
            ) : (
              <span className="order-card-file-ready">{t.fileReady}</span>
            )}
          </div>
        )}
        {fieldErrors[category] && <p className="order-card-field-error">{fieldErrors[category]}</p>}
      </div>
    );
  };

  return (
    <div className="order-card-page" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <button
        type="button"
        className="order-card-translate-btn"
        onClick={toggleLanguage}
        aria-label={t.translateButton}
      >
        {t.translateButton}
      </button>

      <header className="order-card-header">
        <button type="button" className="order-card-back" onClick={() => navigate('/dashboard')}>
          {t.backHome}
        </button>
        <div className="order-card-price-pill" aria-hidden="true">
          {t.priceBadge}
        </div>
        <h1>{t.pageTitle}</h1>
        <p className="order-card-sub">{t.pageSubtitle}</p>
        <p className="order-card-price-note">{t.priceNote}</p>
      </header>

      <form className="order-card-form" onSubmit={handleSubmit} noValidate>
        <section className="order-card-section">
          <h2>{t.sectionContact}</h2>
          <label className="order-card-field">
            <span>{t.labelFullName}</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                clearFieldError('fullName');
              }}
              placeholder={t.placeholderFullName}
              autoComplete="name"
            />
            {fieldErrors.fullName && <em className="order-card-field-error">{fieldErrors.fullName}</em>}
          </label>
          <label className="order-card-field">
            <span>{t.labelPhone}</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.placeholderPhone}
              autoComplete="tel"
              dir="ltr"
            />
          </label>
        </section>

        <section className="order-card-section">
          <h2>{t.sectionCardStatus}</h2>
          <fieldset className="order-card-fieldset">
            <legend>{t.qReceived}</legend>
            <div className="order-card-choice-row">
              <button
                type="button"
                className={`order-card-choice ${cardReceived === 'yes' ? 'active' : ''}`}
                onClick={() => {
                  setCardReceived('yes');
                  clearFieldError('cardReceived');
                }}
              >
                {t.yes}
              </button>
              <button
                type="button"
                className={`order-card-choice ${cardReceived === 'no' ? 'active' : ''}`}
                onClick={() => {
                  setCardReceived('no');
                  setCardActive(null);
                  setCardIssue('');
                  removeFile('card_photo');
                  clearFieldError('cardReceived');
                  clearFieldError('cardActive');
                  clearFieldError('cardIssue');
                  clearFieldError('card_photo');
                }}
              >
                {t.no}
              </button>
            </div>
            {cardReceived === 'yes' && <p className="order-card-hint">{t.receivedHintYes}</p>}
            {cardReceived === 'no' && <p className="order-card-hint">{t.receivedHintNo}</p>}
            {fieldErrors.cardReceived && (
              <p className="order-card-field-error">{fieldErrors.cardReceived}</p>
            )}
          </fieldset>

          {needsCardFollowUp && (
            <>
              <fieldset className="order-card-fieldset">
                <legend>{t.qActive}</legend>
                <div className="order-card-choice-row">
                  <button
                    type="button"
                    className={`order-card-choice ${cardActive === 'yes' ? 'active' : ''}`}
                    onClick={() => {
                      setCardActive('yes');
                      clearFieldError('cardActive');
                    }}
                  >
                    {t.yes}
                  </button>
                  <button
                    type="button"
                    className={`order-card-choice ${cardActive === 'no' ? 'active' : ''}`}
                    onClick={() => {
                      setCardActive('no');
                      clearFieldError('cardActive');
                    }}
                  >
                    {t.no}
                  </button>
                </div>
                {fieldErrors.cardActive && (
                  <p className="order-card-field-error">{fieldErrors.cardActive}</p>
                )}
              </fieldset>

              <fieldset className="order-card-fieldset">
                <legend>{t.qIssue}</legend>
                <div className="order-card-radio-list">
                  {ISSUE_OPTIONS.map((opt) => (
                    <label key={opt} className={`order-card-radio ${cardIssue === opt ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="cardIssue"
                        value={opt}
                        checked={cardIssue === opt}
                        onChange={() => {
                          setCardIssue(opt);
                          clearFieldError('cardIssue');
                        }}
                      />
                      <span>
                        {opt === 'none' && t.issueNone}
                        {opt === 'stolen' && t.issueStolen}
                        {opt === 'lost' && t.issueLost}
                        {opt === 'not_working' && t.issueNotWorking}
                      </span>
                    </label>
                  ))}
                </div>
                {fieldErrors.cardIssue && (
                  <p className="order-card-field-error">{fieldErrors.cardIssue}</p>
                )}
              </fieldset>

              {renderUpload('card_photo', t.qCardPhoto, t.cardPhotoHint, cardPhotoRequired)}
            </>
          )}
        </section>

        <section className="order-card-section">
          <h2>{t.sectionDocs}</h2>
          <p className="order-card-docs-intro">{t.docsIntro}</p>
          {renderUpload('id_doc', t.labelIdDoc, t.idDocHint)}
          {renderUpload('ssn', t.labelSsn, t.ssnHint)}
          {renderUpload('payment', t.labelPayment, t.paymentHint)}
        </section>

        {error && (
          <div className="order-card-error" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="order-card-submit"
          disabled={submitting || pendingUploads > 0}
        >
          {submitting ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
};

export default OrderCard;
