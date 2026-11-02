import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import CreditAgreementSheet from '../components/CreditAgreementSheet';
import { ID_DOC_TYPES, localTodayYyyyMmDd } from '../data/creditAgreement';
import { compressImageFile, readFileAsDataUrl } from '../utils/imageCompression';
import './CreditAgreement.css';

const copy = {
  he: {
    print: 'הדפסה',
    back: 'חזרה',
    intro: 'קראו את ההסכם, מלאו את השם, חתמו, וצרפו מסמך סושיאל סקיוריטי ומסמך זיהוי.',
    ssnTitle: 'סושיאל סקיוריטי',
    ssnPhoto: 'תמונה של הכרטיס',
    ssnNumber: 'מספר הכרטיס',
    ssnHint: 'אפשר להעלות תמונה של כרטיס הסושיאל, או להקליד את המספר.',
    ssnPlaceholder: '123-45-6789',
    idTitle: 'מסמך זיהוי',
    idHint: 'העלו אחד מהבאים: דרכון, רישיון נהיגה אמריקאי, או תעודת זהות אמריקאית.',
    chooseFile: 'בחירת קובץ',
    uploading: 'מעלה...',
    removeFile: 'הסרה',
    fileReady: 'הקובץ נקלט',
    submit: 'שליחת ההסכם החתום',
    submitting: 'שולח...',
    clearSignature: 'ניקוי חתימה',
    errorName: 'נא למלא את שם הלקוח',
    errorDate: 'נא לבחור תאריך חתימה',
    errorSignature: 'נא לחתום בתיבת החתימה',
    errorSsnPhoto: 'נא להעלות תמונה של כרטיס הסושיאל',
    errorSsnNumber: 'נא להקליד מספר סושיאל בן 9 ספרות',
    errorId: 'נא להעלות את מסמך הזיהוי',
    errorUpload: 'העלאת הקובץ נכשלה',
    errorLogin: 'יש להתחבר לפני השליחה',
    errorPending: 'ממתינים לסיום העלאת הקבצים',
    errorFileType: 'אפשר להעלות תמונה או PDF',
  },
  en: {
    print: 'Print',
    back: 'Back',
    intro: 'Read the agreement, enter your name, sign, and attach a Social Security document and an ID.',
    ssnTitle: 'Social Security',
    ssnPhoto: 'Photo of the card',
    ssnNumber: 'Card number',
    ssnHint: 'Upload a photo of the Social Security card, or type the number.',
    ssnPlaceholder: '123-45-6789',
    idTitle: 'Identification',
    idHint: 'Upload one of these: a passport, a U.S. driver license, or a U.S. ID card.',
    chooseFile: 'Choose file',
    uploading: 'Uploading...',
    removeFile: 'Remove',
    fileReady: 'File received',
    submit: 'Submit the signed agreement',
    submitting: 'Sending...',
    clearSignature: 'Clear signature',
    errorName: 'Please enter the client name',
    errorDate: 'Please choose a signature date',
    errorSignature: 'Please sign in the signature box',
    errorSsnPhoto: 'Please upload a photo of the Social Security card',
    errorSsnNumber: 'Please enter a 9-digit Social Security number',
    errorId: 'Please upload the identification document',
    errorUpload: 'File upload failed',
    errorLogin: 'Please sign in before submitting',
    errorPending: 'Wait until the file upload finishes',
    errorFileType: 'Upload an image or a PDF',
  },
};

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 9);
}

const CreditAgreement = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { token } = useAuth();
  const t = copy[language] || copy.he;

  const [fullName, setFullName] = useState('');
  const [signDate, setSignDate] = useState(localTodayYyyyMmDd);
  const [signature, setSignature] = useState('');
  const [ssnMode, setSsnMode] = useState('photo');
  const [ssnNumber, setSsnNumber] = useState('');
  const [ssnPath, setSsnPath] = useState('');
  const [ssnPreview, setSsnPreview] = useState('');
  const [idDocType, setIdDocType] = useState('passport');
  const [idPath, setIdPath] = useState('');
  const [idPreview, setIdPreview] = useState('');
  const [pendingUploads, setPendingUploads] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const inputsRef = useRef({});

  const uploadFile = async (file, category) => {
    if (!token) throw new Error(t.errorLogin);
    const data = file.type === 'application/pdf' ? await readFileAsDataUrl(file) : await compressImageFile(file);
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
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError(t.errorFileType);
      return;
    }
    setPendingUploads((n) => n + 1);
    setError('');
    try {
      const { path, preview } = await uploadFile(file, category);
      if (category === 'ssn') {
        setSsnPath(path);
        setSsnPreview(preview);
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.ssn;
          return next;
        });
      } else {
        setIdPath(path);
        setIdPreview(preview);
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.id;
          return next;
        });
      }
    } catch {
      setError(t.errorUpload);
    } finally {
      setPendingUploads((n) => Math.max(0, n - 1));
    }
  };

  const validate = () => {
    const errs = {};
    if (!fullName.trim()) errs.name = t.errorName;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(signDate)) errs.date = t.errorDate;
    if (!signature) errs.signature = t.errorSignature;
    if (ssnMode === 'number') {
      if (digitsOnly(ssnNumber).length !== 9) errs.ssn = t.errorSsnNumber;
    } else if (!ssnPath) {
      errs.ssn = t.errorSsnPhoto;
    }
    if (!idPath) errs.id = t.errorId;
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
      await axios.post(
        '/cases/credit-agreement',
        {
          fullName: fullName.trim(),
          signDate,
          signatureImage: signature,
          ssnMode,
          ssnNumber: ssnMode === 'number' ? ssnNumber : '',
          ssnImage: ssnMode === 'photo' ? ssnPath : '',
          idDocType,
          idImage: idPath,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate('/confirmation', { state: { benefitType: 'credit_agreement' } });
    } catch (err) {
      setError(err.response?.data?.error || t.errorUpload);
    } finally {
      setSubmitting(false);
    }
  };

  const renderUpload = ({ category, path, preview, errorKey }) => {
    const isPdf = typeof preview === 'string' && preview.startsWith('data:application/pdf');
    return (
      <div className={`credit-upload ${fieldErrors[errorKey] ? 'has-error' : ''}`}>
        <input
          ref={(el) => {
            inputsRef.current[category] = el;
          }}
          type="file"
          accept="image/*,.pdf,application/pdf"
          hidden
          onChange={handleFilePick(category)}
        />
        <div className="credit-upload-actions">
          <button type="button" className="credit-file-btn" onClick={() => inputsRef.current[category]?.click()}>
            {pendingUploads > 0 && !path ? t.uploading : t.chooseFile}
          </button>
          {path ? (
            <button
              type="button"
              className="credit-remove-btn"
              onClick={() => {
                if (category === 'ssn') {
                  setSsnPath('');
                  setSsnPreview('');
                } else {
                  setIdPath('');
                  setIdPreview('');
                }
              }}
            >
              {t.removeFile}
            </button>
          ) : null}
        </div>
        {path ? (
          <div className="credit-preview">
            {preview && !isPdf ? <img src={preview} alt="" /> : <span>{t.fileReady}</span>}
          </div>
        ) : null}
        {fieldErrors[errorKey] ? <p className="credit-field-error">{fieldErrors[errorKey]}</p> : null}
      </div>
    );
  };

  return (
    <div className="credit-page" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <div className="credit-bar credit-skip">
        <button type="button" className="credit-print-btn" onClick={() => window.print()}>
          {t.print}
        </button>
        <button type="button" className="credit-back-btn" onClick={() => navigate('/dashboard')}>
          {t.back}
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <CreditAgreementSheet
          clientName={fullName}
          signDate={signDate}
          onClientNameChange={setFullName}
          onSignDateChange={setSignDate}
          onClientSignatureChange={setSignature}
          clearSignatureLabel={t.clearSignature}
        />
        {(fieldErrors.name || fieldErrors.date || fieldErrors.signature) && (
          <div className="credit-form-errors credit-skip">
            {fieldErrors.name ? <p>{fieldErrors.name}</p> : null}
            {fieldErrors.date ? <p>{fieldErrors.date}</p> : null}
            {fieldErrors.signature ? <p>{fieldErrors.signature}</p> : null}
          </div>
        )}

        <section className="credit-extra credit-skip">
          <p className="credit-extra-intro">{t.intro}</p>

          <h2>{t.ssnTitle}</h2>
          <p className="credit-extra-hint">{t.ssnHint}</p>
          <div className="credit-choice">
            <label>
              <input
                type="radio"
                name="ssnMode"
                checked={ssnMode === 'photo'}
                onChange={() => setSsnMode('photo')}
              />
              {t.ssnPhoto}
            </label>
            <label>
              <input
                type="radio"
                name="ssnMode"
                checked={ssnMode === 'number'}
                onChange={() => setSsnMode('number')}
              />
              {t.ssnNumber}
            </label>
          </div>
          {ssnMode === 'number' ? (
            <div className={fieldErrors.ssn ? 'has-error' : ''}>
              <input
                className="credit-ssn-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t.ssnPlaceholder}
                value={ssnNumber}
                onChange={(e) => setSsnNumber(digitsOnly(e.target.value))}
              />
              {fieldErrors.ssn ? <p className="credit-field-error">{fieldErrors.ssn}</p> : null}
            </div>
          ) : (
            renderUpload({ category: 'ssn', path: ssnPath, preview: ssnPreview, errorKey: 'ssn' })
          )}

          <h2>{t.idTitle}</h2>
          <p className="credit-extra-hint">{t.idHint}</p>
          <div className="credit-choice">
            {ID_DOC_TYPES.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="idDocType"
                  checked={idDocType === option.value}
                  onChange={() => setIdDocType(option.value)}
                />
                {language === 'en' ? option.en : option.he}
              </label>
            ))}
          </div>
          {renderUpload({ category: 'id_doc', path: idPath, preview: idPreview, errorKey: 'id' })}

          {error ? <p className="credit-form-error">{error}</p> : null}
          <button type="submit" className="credit-submit" disabled={submitting || pendingUploads > 0}>
            {submitting ? t.submitting : t.submit}
          </button>
        </section>
      </form>
    </div>
  );
};

export default CreditAgreement;
