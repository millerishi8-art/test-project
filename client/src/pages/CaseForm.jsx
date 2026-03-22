import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { caseFormTranslations } from '../translations/caseForm';
import { buildGoogleCalendarUrl, openGoogleCalendarInNewTab } from '../utils/googleCalendar';
import './CaseForm.css';

const SIGNATURE_PAD_WIDTH = 400;
const SIGNATURE_PAD_HEIGHT = 160;

function newSpouseDocumentsEntry() {
  return {
    passportImage: '',
    ssnImage: '',
    healthStatus: '',
  };
}

function newFamilyChildEntry() {
  return {
    id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    age: '',
    dob: '',
    schoolClass: '',
    medicalIssues: '',
    passportImage: '',
    ssnImage: '',
    medicalFormsImage: '',
  };
}

function getFormDataForBenefitType() {
  return {
    address: '',
    familyBackground: '',
    personalDetails: '',
    signature: false,
    signatoryName: '',
    signatureImage: '',
    fullName: '',
    dob: '',
    birthPlace: 'Israel',
    fatherName: '',
    motherName: '',
    maritalStatus: 'Single',
    dependentsCount: 0,
    additionalCitizenship: 'No',
    previousCase: false,
    activeCase: false,
    caseEmail: '',
    casePassword: '',
    dec1: false,
    dec2: false,
    dec3: false,
    dec4: false,
  };
}

/** טופס מורחב (זכאות פוד סטאמפס) לכל סוגי ההטבות: משפחה, בגיר, צעיר */
const EXPANDED_CASE_FORM_TYPES = ['family', 'individual', 'minor'];

const CaseForm = () => {
  const { type } = useParams();
  const useExpandedFoodStampsForm = EXPANDED_CASE_FORM_TYPES.includes(type);
  const isFamilyCase = type === 'family';
  const navigate = useNavigate();
  const { token } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const t = caseFormTranslations[language];
  const canvasRef = useRef(null);

  const [formData, setFormData] = useState(() => getFormDataForBenefitType());
  /** @type {{ id: string, data: string, category?: string }[]} */
  const [attachments, setAttachments] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBenefit, setLoadingBenefit] = useState(true);
  const [benefit, setBenefit] = useState(null);
  const [renewalAddedToCalendar, setRenewalAddedToCalendar] = useState(false);
  const [familyChildren, setFamilyChildren] = useState([]);
  /** @type {{ passportImage: string, ssnImage: string, healthStatus: string } | null} */
  const [spouseBlock, setSpouseBlock] = useState(null);

  useEffect(() => {
    setFormData(getFormDataForBenefitType());
    setAttachments([]);
    setFamilyChildren([]);
    setSpouseBlock(null);
    setRenewalAddedToCalendar(false);
    setError('');
  }, [type]);

  useEffect(() => {
    fetchBenefit();
  }, [type]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIGNATURE_PAD_WIDTH * dpr;
    canvas.height = SIGNATURE_PAD_HEIGHT * dpr;
    canvas.style.width = `${SIGNATURE_PAD_WIDTH}px`;
    canvas.style.height = `${SIGNATURE_PAD_HEIGHT}px`;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, SIGNATURE_PAD_WIDTH, SIGNATURE_PAD_HEIGHT);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, [type, useExpandedFoodStampsForm]);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * SIGNATURE_PAD_WIDTH,
      y: ((clientY - rect.top) / rect.height) * SIGNATURE_PAD_HEIGHT,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const p = getPoint(e);
    if (!p) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const p = getPoint(e);
    if (!p) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    e.preventDefault();
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          const dataUrl = canvas.toDataURL('image/png', 0.85);
          setFormData((prev) => ({ ...prev, signatureImage: dataUrl }));
        } catch (_) {}
      }
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, SIGNATURE_PAD_WIDTH, SIGNATURE_PAD_HEIGHT);
    setFormData((prev) => ({ ...prev, signatureImage: '' }));
    setError('');
  };

  const fetchBenefit = async () => {
    try {
      const response = await axios.get('/benefits');
      setBenefit(response.data[type]);
    } catch (err) {
      console.error('Failed to fetch benefit:', err);
    } finally {
      setLoadingBenefit(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type: inputType, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: inputType === 'checkbox' ? checked : value,
    }));
    setError('');
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const updateFamilyChild = (childId, patch) => {
    setFamilyChildren((prev) => prev.map((c) => (c.id === childId ? { ...c, ...patch } : c)));
    setError('');
  };

  const handleChildFile = (childId, field) => async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      e.target.value = '';
      return;
    }
    const data = await readFileAsDataUrl(file);
    updateFamilyChild(childId, { [field]: data });
    e.target.value = '';
  };

  const addFamilyChild = () => {
    setFamilyChildren((prev) => [...prev, newFamilyChildEntry()]);
    setError('');
  };

  const removeFamilyChild = (childId) => {
    setFamilyChildren((prev) => prev.filter((c) => c.id !== childId));
    setError('');
  };

  const addSpouseDocuments = () => {
    setSpouseBlock(newSpouseDocumentsEntry());
    setError('');
  };

  const removeSpouseDocuments = () => {
    setSpouseBlock(null);
    setError('');
  };

  const handleSpouseFile = (field) => async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      e.target.value = '';
      return;
    }
    const data = await readFileAsDataUrl(file);
    setSpouseBlock((prev) => (prev ? { ...prev, [field]: data } : prev));
    e.target.value = '';
    setError('');
  };

  const updateSpouseBlock = (patch) => {
    setSpouseBlock((prev) => (prev ? { ...prev, ...patch } : prev));
    setError('');
  };

  const handleCategoryFiles = (category) => async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const okFiles = files.filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
    const newItems = await Promise.all(
      okFiles.map(async (file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        data: await readFileAsDataUrl(file),
        category,
      }))
    );
    setAttachments((prev) => [...prev, ...newItems]);
    e.target.value = '';
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const getRenewalDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d;
  };

  const getCalendarUrl = () => {
    const renewalDate = getRenewalDate();
    const endDate = new Date(renewalDate.getTime() + 60 * 60 * 1000);
    const title = language === 'he' ? 'חידוש קייס - תזכורת' : 'Case renewal - reminder';
    return buildGoogleCalendarUrl({
      title,
      startDate: renewalDate,
      endDate,
      details: t.renewalAlertBody || '',
      location: language === 'he' ? 'מערכת סוכן ביטוח' : 'Insurance Agent System',
    });
  };

  const handleAddToCalendar = () => {
    openGoogleCalendarInNewTab(getCalendarUrl());
    setRenewalAddedToCalendar(true);
  };

  const doActualSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const childAttachments =
        isFamilyCase && familyChildren.length
          ? familyChildren.flatMap((c) => {
              const rows = [];
              if (c.passportImage) rows.push({ data: c.passportImage, category: `child_${c.id}_passport` });
              if (c.ssnImage) rows.push({ data: c.ssnImage, category: `child_${c.id}_ssn` });
              if ((c.medicalIssues || '').trim() && c.medicalFormsImage) {
                rows.push({ data: c.medicalFormsImage, category: `child_${c.id}_medical` });
              }
              return rows;
            })
          : [];

      const familyChildrenDetails =
        isFamilyCase && familyChildren.length
          ? familyChildren.map(({ id, age, dob, schoolClass, medicalIssues }) => ({
              id,
              age,
              dob,
              schoolClass,
              medicalIssues,
            }))
          : undefined;

      const spouseAttachments =
        isFamilyCase && spouseBlock
          ? [
              ...(spouseBlock.passportImage
                ? [{ data: spouseBlock.passportImage, category: 'spouse_passport' }]
                : []),
              ...(spouseBlock.ssnImage ? [{ data: spouseBlock.ssnImage, category: 'spouse_ssn' }] : []),
            ]
          : [];

      await axios.post(
        '/cases',
        {
          benefitType: type,
          ...formData,
          signatoryName: (formData.signatoryName || '').trim() || undefined,
          signatureImage: formData.signatureImage || undefined,
          familyChildrenDetails,
          spouseIncluded: Boolean(isFamilyCase && spouseBlock),
          spouseHealthStatus:
            isFamilyCase && spouseBlock ? (spouseBlock.healthStatus || '').trim() : undefined,
          attachments: [
            ...attachments.map((a) => ({ data: a.data, category: a.category })),
            ...spouseAttachments,
            ...childAttachments,
          ],
          documentType: 'passport',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate('/confirmation', { state: { benefitType: type } });
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error;
      if (status === 401) {
        setError(t.errorSessionExpired);
      } else if (status === 403) {
        setError(msg || t.errorNoPermission);
      } else if (!err.response) {
        setError(t.errorServerDown);
      } else if (status >= 500 || msg) {
        setError(msg || t.errorServerError);
      } else {
        setError(msg || t.errorSubmit);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!useExpandedFoodStampsForm) {
      setError(t.errorFillRequired);
      return;
    }

    if (
      !formData.fullName ||
      !formData.dob ||
      !formData.birthPlace ||
      !formData.address ||
      !formData.fatherName ||
      !formData.motherName ||
      !formData.maritalStatus ||
      formData.dependentsCount === '' ||
      Number(formData.dependentsCount) < 0 ||
      !formData.additionalCitizenship
    ) {
      setError(t.errorFillRequired);
      return;
    }

    if (formData.previousCase || formData.activeCase) {
      const em = (formData.caseEmail || '').trim();
      const pw = (formData.casePassword || '').trim();
      if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        setError(t.errorCaseEmailInvalid);
        return;
      }
      if (!pw) {
        setError(t.errorCasePasswordRequired);
        return;
      }
    }

    if (!attachments.some((a) => a.category === 'birth')) {
      setError(t.errorMissingBirthCerts);
      return;
    }
    if (!attachments.some((a) => a.category === 'ssn')) {
      setError(t.errorMissingSSN);
      return;
    }
    if (!attachments.some((a) => a.category === 'passport')) {
      setError(t.errorMissingPassport);
      return;
    }
    if (isFamilyCase && !attachments.some((a) => a.category === 'marriage_certificate_us')) {
      setError(t.errorMissingAmericanMarriageCertificate);
      return;
    }
    if (!attachments.some((a) => a.category === 'payment')) {
      setError(t.errorMissingPayment);
      return;
    }

    if (isFamilyCase && spouseBlock) {
      if (!spouseBlock.passportImage?.trim() || !spouseBlock.ssnImage?.trim()) {
        setError(t.errorSpouseIncomplete);
        return;
      }
      if (!(spouseBlock.healthStatus || '').trim()) {
        setError(t.errorSpouseHealthRequired);
        return;
      }
    }

    if (isFamilyCase && familyChildren.length > 0) {
      for (const c of familyChildren) {
        const ageOk = c.age !== '' && c.age != null && String(c.age).trim() !== '';
        const classOk = (c.schoolClass || '').trim().length > 0;
        if (
          !c.passportImage?.trim() ||
          !c.ssnImage?.trim() ||
          !c.dob ||
          !ageOk ||
          !classOk
        ) {
          setError(t.errorChildIncomplete);
          return;
        }
        if ((c.medicalIssues || '').trim() && !c.medicalFormsImage?.trim()) {
          setError(t.errorChildMedicalDocs);
          return;
        }
      }
    }

    if (!(formData.signatureImage || '').trim()) {
      setError(t.errorDrawSignature);
      return;
    }

    const englishOnlyRegex = /^[A-Za-z0-9\s.,#'/-]+$/;
    if (
      !englishOnlyRegex.test(formData.fullName) ||
      !englishOnlyRegex.test(formData.address) ||
      !englishOnlyRegex.test(formData.fatherName) ||
      !englishOnlyRegex.test(formData.motherName)
    ) {
      setError(t.errorEnglishOnly);
      return;
    }

    if (!formData.dec1 || !formData.dec2 || !formData.dec3 || !formData.dec4 || !formData.signature) {
      setError(t.errorConfirmSignature);
      return;
    }
    if (!token) {
      setError(t.errorLoginRequired);
      return;
    }
    if (!renewalAddedToCalendar) {
      setError(t.renewalRequiredFirst);
      return;
    }
    await doActualSubmit();
  };

  const benefitTitle =
    type && t.benefitTitles?.[type] ? t.benefitTitles[type] : benefit?.title;

  if (loadingBenefit) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">{t.loading}</div>
      </div>
    );
  }

  return (
    <div className="case-form-container" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <button
        type="button"
        className="case-form-translate-btn"
        onClick={toggleLanguage}
        title={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
        aria-label={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
      >
        {t.translateButton}
      </button>

      <div className="case-form-card">
        <h1>
          {t.pageTitle} – {benefitTitle}
        </h1>
        <p className="form-subtitle">
          {useExpandedFoodStampsForm ? t.formSubtitleFoodStamps : t.simpleFormSubtitle}
        </p>

        <form onSubmit={handleSubmit}>
          {useExpandedFoodStampsForm ? (
            <>
              <div className="form-section">
                <h2>{t.sectionPersonal}</h2>
                <div className="form-group">
                  <label>{t.labelFullName}</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    placeholder={t.placeholderFullName}
                    dir="ltr"
                    autoComplete="name"
                  />
                </div>
                <div className="form-group">
                  <label>{t.labelDob}</label>
                  <input type="date" name="dob" value={formData.dob} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>{t.labelBirthPlace}</label>
                  <select name="birthPlace" value={formData.birthPlace} onChange={handleChange} required>
                    <option value="Israel">{t.birthPlaceIsrael}</option>
                    <option value="New York">{t.birthPlaceNY}</option>
                    <option value="Other">{t.birthPlaceOther}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t.labelAddress}</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows="3"
                    required
                    placeholder={t.placeholderAddress}
                    dir="ltr"
                  />
                </div>
                <div className="form-group">
                  <label>{t.labelParentalDetails}</label>
                  <div className="nested-group">
                    <label>{t.labelFatherName}</label>
                    <input
                      type="text"
                      name="fatherName"
                      value={formData.fatherName}
                      onChange={handleChange}
                      required
                      placeholder={t.placeholderFatherName}
                      dir="ltr"
                    />
                    <label style={{ marginTop: '15px' }}>{t.labelMotherName}</label>
                    <input
                      type="text"
                      name="motherName"
                      value={formData.motherName}
                      onChange={handleChange}
                      required
                      placeholder={t.placeholderMotherName}
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h2>{t.sectionFamily}</h2>
                <div className="form-group">
                  <label>{t.labelMaritalStatus}</label>
                  <select name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} required>
                    <option value="Single">{t.maritalSingle}</option>
                    <option value="Married living with spouse">{t.maritalMarriedSpouse}</option>
                    <option value="Married living with spouse & children">{t.maritalMarriedChildren}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t.labelDependents}</label>
                  <input
                    type="number"
                    name="dependentsCount"
                    value={formData.dependentsCount}
                    onChange={handleChange}
                    min="0"
                    required
                    placeholder={t.placeholderDependents}
                  />
                </div>
                <div className="form-group">
                  <label>{t.citizenshipQuestion}</label>
                  <div className="radio-group">
                    <label>
                      <input
                        type="radio"
                        name="additionalCitizenship"
                        value="Yes"
                        checked={formData.additionalCitizenship === 'Yes'}
                        onChange={handleChange}
                      />
                      {t.citizenshipYes}
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="additionalCitizenship"
                        value="No"
                        checked={formData.additionalCitizenship === 'No'}
                        onChange={handleChange}
                      />
                      {t.citizenshipNo}
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h2>{t.sectionHistory}</h2>
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="previousCase"
                    name="previousCase"
                    checked={formData.previousCase}
                    onChange={handleChange}
                  />
                  <label htmlFor="previousCase">{t.labelPreviousCase}</label>
                </div>
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="activeCase"
                    name="activeCase"
                    checked={formData.activeCase}
                    onChange={handleChange}
                  />
                  <label htmlFor="activeCase">{t.labelActiveCase}</label>
                </div>
                {(formData.previousCase || formData.activeCase) && (
                  <div className="form-group nested-group" style={{ marginTop: '15px' }}>
                    <label>{t.labelAccessCredentials}</label>
                    <label style={{ marginTop: '10px' }}>{t.labelCaseEmail}</label>
                    <input
                      type="email"
                      name="caseEmail"
                      value={formData.caseEmail}
                      onChange={handleChange}
                      placeholder={t.placeholderCaseEmail}
                      dir="ltr"
                    />
                    <label style={{ marginTop: '10px' }}>{t.labelCasePassword}</label>
                    <input
                      type="password"
                      name="casePassword"
                      value={formData.casePassword}
                      onChange={handleChange}
                      placeholder={t.placeholderCasePassword}
                      dir="ltr"
                    />
                  </div>
                )}
              </div>

              <div className="form-section images-section">
                <div className="images-section-card">
                  <h2 className="images-section-title">{t.sectionImages}</h2>
                  <p className="images-section-hint">{t.sectionImagesHint}</p>
                  <div
                    className="document-type-row"
                    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '15px' }}
                  >
                    <div style={{ width: '100%' }}>
                      <label className="document-type-label" style={{ display: 'block', marginBottom: '5px' }}>
                        {t.labelBirthCertificates}
                      </label>
                      <p className="upload-field-hint">{t.hintBirthCertificates}</p>
                      <div className="upload-buttons-row">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          multiple
                          className="hidden-file-input"
                          onChange={handleCategoryFiles('birth')}
                          id="upload-birth"
                        />
                        <button
                          type="button"
                          className="upload-source-btn device-btn"
                          onClick={() => document.getElementById('upload-birth').click()}
                        >
                          <span className="upload-btn-icon">📁</span>
                          {t.uploadFromDevice}
                        </button>
                      </div>
                    </div>

                    <div style={{ width: '100%' }}>
                      <label className="document-type-label" style={{ display: 'block', marginBottom: '5px' }}>
                        {t.labelSSN}
                      </label>
                      <p className="upload-field-hint">{t.hintSSN}</p>
                      <div className="upload-buttons-row">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          multiple
                          className="hidden-file-input"
                          onChange={handleCategoryFiles('ssn')}
                          id="upload-ssn"
                        />
                        <button
                          type="button"
                          className="upload-source-btn device-btn"
                          onClick={() => document.getElementById('upload-ssn').click()}
                        >
                          <span className="upload-btn-icon">📁</span>
                          {t.uploadFromDevice}
                        </button>
                      </div>
                    </div>

                    <div style={{ width: '100%' }}>
                      <label className="document-type-label" style={{ display: 'block', marginBottom: '5px' }}>
                        {t.labelPassport}
                      </label>
                      <p className="upload-field-hint">{t.hintPassport}</p>
                      <div className="upload-buttons-row">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          multiple
                          className="hidden-file-input"
                          onChange={handleCategoryFiles('passport')}
                          id="upload-passport"
                        />
                        <button
                          type="button"
                          className="upload-source-btn device-btn"
                          onClick={() => document.getElementById('upload-passport').click()}
                        >
                          <span className="upload-btn-icon">📁</span>
                          {t.uploadFromDevice}
                        </button>
                      </div>
                    </div>

                    {isFamilyCase && (
                      <div style={{ width: '100%' }}>
                        <label className="document-type-label" style={{ display: 'block', marginBottom: '5px' }}>
                          {t.labelAmericanMarriageCertificate}
                        </label>
                        <p className="upload-field-hint">{t.hintAmericanMarriageCertificate}</p>
                        <div className="upload-buttons-row">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            multiple
                            className="hidden-file-input"
                            onChange={handleCategoryFiles('marriage_certificate_us')}
                            id="upload-marriage-certificate-us"
                          />
                          <button
                            type="button"
                            className="upload-source-btn device-btn"
                            onClick={() => document.getElementById('upload-marriage-certificate-us').click()}
                          >
                            <span className="upload-btn-icon">📁</span>
                            {t.uploadFromDevice}
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ width: '100%' }}>
                      <label className="document-type-label" style={{ display: 'block', marginBottom: '5px' }}>
                        {t.labelProofOfPayment}
                      </label>
                      <p className="upload-field-hint">{t.hintProofOfPayment}</p>
                      <div className="upload-buttons-row">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          multiple
                          className="hidden-file-input"
                          onChange={handleCategoryFiles('payment')}
                          id="upload-payment"
                        />
                        <button
                          type="button"
                          className="upload-source-btn device-btn"
                          onClick={() => document.getElementById('upload-payment').click()}
                        >
                          <span className="upload-btn-icon">📁</span>
                          {t.uploadFromDevice}
                        </button>
                      </div>
                    </div>
                  </div>

                  {attachments.length > 0 && (
                    <div className="attachments-preview">
                      {attachments.map((att) => (
                        <div key={att.id} className="attachment-thumb-wrap">
                          {att.data.startsWith('data:application/pdf') ? (
                            <div className="attachment-thumb pdf-thumb">PDF</div>
                          ) : (
                            <img src={att.data} alt="" className="attachment-thumb" />
                          )}
                          <button
                            type="button"
                            className="attachment-remove"
                            onClick={() => removeAttachment(att.id)}
                            aria-label={t.removeImage}
                            title={t.removeImage}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {isFamilyCase && (
                <div className="form-section spouse-documents-section">
                  <h2>{t.sectionSpouseDocuments}</h2>
                  <p className="family-children-intro">{t.spouseDocumentsIntro}</p>
                  {!spouseBlock ? (
                    <button type="button" className="add-family-child-btn" onClick={addSpouseDocuments}>
                      {t.addSpouseDocumentsBtn}
                    </button>
                  ) : (
                    <div className="family-child-card">
                      <div className="family-child-card-header">
                        <h3 className="family-child-card-title">{t.spouseCardTitle}</h3>
                        <button type="button" className="remove-family-child-btn" onClick={removeSpouseDocuments}>
                          {t.removeSpouseSection}
                        </button>
                      </div>
                      <div className="form-group">
                        <label>{t.labelSpousePassport}</label>
                        <p className="upload-field-hint">{t.hintSpousePassport}</p>
                        <div className="upload-buttons-row">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden-file-input"
                            id="spouse-passport-upload"
                            onChange={handleSpouseFile('passportImage')}
                          />
                          <button
                            type="button"
                            className="upload-source-btn device-btn"
                            onClick={() => document.getElementById('spouse-passport-upload').click()}
                          >
                            <span className="upload-btn-icon">📁</span>
                            {t.uploadFromDevice}
                          </button>
                        </div>
                        {spouseBlock.passportImage ? (
                          <p className="child-file-attached">✓ {t.childFileUploaded}</p>
                        ) : null}
                      </div>
                      <div className="form-group">
                        <label>{t.labelSpouseSSN}</label>
                        <p className="upload-field-hint">{t.hintSpouseSSN}</p>
                        <div className="upload-buttons-row">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden-file-input"
                            id="spouse-ssn-upload"
                            onChange={handleSpouseFile('ssnImage')}
                          />
                          <button
                            type="button"
                            className="upload-source-btn device-btn"
                            onClick={() => document.getElementById('spouse-ssn-upload').click()}
                          >
                            <span className="upload-btn-icon">📁</span>
                            {t.uploadFromDevice}
                          </button>
                        </div>
                        {spouseBlock.ssnImage ? (
                          <p className="child-file-attached">✓ {t.childFileUploaded}</p>
                        ) : null}
                      </div>
                      <div className="form-group">
                        <label htmlFor="spouse-health-status">{t.labelSpouseHealth}</label>
                        <p className="upload-field-hint">{t.hintSpouseHealth}</p>
                        <textarea
                          id="spouse-health-status"
                          rows={4}
                          value={spouseBlock.healthStatus}
                          onChange={(e) => updateSpouseBlock({ healthStatus: e.target.value })}
                          placeholder={t.placeholderSpouseHealth}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isFamilyCase && (
                <div className="form-section family-children-section">
                  <h2>{t.sectionFamilyChildren}</h2>
                  <p className="family-children-intro">{t.familyChildrenIntro}</p>
                  <button type="button" className="add-family-child-btn" onClick={addFamilyChild}>
                    {t.addAnotherChild}
                  </button>
                  {familyChildren.map((child, index) => (
                    <div key={child.id} className="family-child-card">
                      <div className="family-child-card-header">
                        <h3 className="family-child-card-title">
                          {t.childNumberLabel} {index + 1}
                        </h3>
                        <button
                          type="button"
                          className="remove-family-child-btn"
                          onClick={() => removeFamilyChild(child.id)}
                        >
                          {t.removeChild}
                        </button>
                      </div>
                      <div className="form-group">
                        <label>{t.labelChildPassport}</label>
                        <p className="upload-field-hint">{t.hintChildPassport}</p>
                        <div className="upload-buttons-row">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden-file-input"
                            id={`child-pass-${child.id}`}
                            onChange={handleChildFile(child.id, 'passportImage')}
                          />
                          <button
                            type="button"
                            className="upload-source-btn device-btn"
                            onClick={() => document.getElementById(`child-pass-${child.id}`).click()}
                          >
                            <span className="upload-btn-icon">📁</span>
                            {t.uploadFromDevice}
                          </button>
                        </div>
                        {child.passportImage ? <p className="child-file-attached">✓ {t.childFileUploaded}</p> : null}
                      </div>
                      <div className="form-group">
                        <label>{t.labelChildSSN}</label>
                        <p className="upload-field-hint">{t.hintChildSSN}</p>
                        <div className="upload-buttons-row">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden-file-input"
                            id={`child-ssn-${child.id}`}
                            onChange={handleChildFile(child.id, 'ssnImage')}
                          />
                          <button
                            type="button"
                            className="upload-source-btn device-btn"
                            onClick={() => document.getElementById(`child-ssn-${child.id}`).click()}
                          >
                            <span className="upload-btn-icon">📁</span>
                            {t.uploadFromDevice}
                          </button>
                        </div>
                        {child.ssnImage ? <p className="child-file-attached">✓ {t.childFileUploaded}</p> : null}
                      </div>
                      <div className="form-group">
                        <label htmlFor={`child-age-${child.id}`}>{t.labelChildAge}</label>
                        <input
                          id={`child-age-${child.id}`}
                          type="number"
                          min="0"
                          max="25"
                          value={child.age}
                          onChange={(e) => updateFamilyChild(child.id, { age: e.target.value })}
                          placeholder={t.placeholderChildAge}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor={`child-dob-${child.id}`}>{t.labelChildDob}</label>
                        <input
                          id={`child-dob-${child.id}`}
                          type="date"
                          value={child.dob}
                          onChange={(e) => updateFamilyChild(child.id, { dob: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor={`child-class-${child.id}`}>{t.labelChildSchoolClass}</label>
                        <input
                          id={`child-class-${child.id}`}
                          type="text"
                          value={child.schoolClass}
                          onChange={(e) => updateFamilyChild(child.id, { schoolClass: e.target.value })}
                          placeholder={t.placeholderChildSchoolClass}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor={`child-med-${child.id}`}>{t.labelChildMedicalIssues}</label>
                        <textarea
                          id={`child-med-${child.id}`}
                          rows={3}
                          value={child.medicalIssues}
                          onChange={(e) => updateFamilyChild(child.id, { medicalIssues: e.target.value })}
                          placeholder={t.placeholderChildMedicalIssues}
                        />
                      </div>
                      <div className="form-group">
                        <label>{t.labelChildMedicalForms}</label>
                        <p className="upload-field-hint">{t.hintChildMedicalForms}</p>
                        <div className="upload-buttons-row">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden-file-input"
                            id={`child-medical-${child.id}`}
                            onChange={handleChildFile(child.id, 'medicalFormsImage')}
                          />
                          <button
                            type="button"
                            className="upload-source-btn device-btn"
                            onClick={() => document.getElementById(`child-medical-${child.id}`).click()}
                          >
                            <span className="upload-btn-icon">📁</span>
                            {t.uploadFromDevice}
                          </button>
                        </div>
                        {child.medicalFormsImage ? (
                          <p className="child-file-attached">✓ {t.childFileUploaded}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="form-section declarations-section">
                <h2>{t.sectionDeclarations}</h2>
                <div className="checkbox-group">
                  <input type="checkbox" id="dec1" name="dec1" checked={formData.dec1} onChange={handleChange} required />
                  <label htmlFor="dec1">{t.dec1}</label>
                </div>
                <div className="checkbox-group">
                  <input type="checkbox" id="dec2" name="dec2" checked={formData.dec2} onChange={handleChange} required />
                  <label htmlFor="dec2">{t.dec2}</label>
                </div>
                <div className="checkbox-group">
                  <input type="checkbox" id="dec3" name="dec3" checked={formData.dec3} onChange={handleChange} required />
                  <label htmlFor="dec3">{t.dec3}</label>
                </div>
                <div className="checkbox-group">
                  <input type="checkbox" id="dec4" name="dec4" checked={formData.dec4} onChange={handleChange} required />
                  <label htmlFor="dec4">{t.dec4}</label>
                </div>
              </div>
            </>
          ) : (
            <p className="form-subtitle" style={{ textAlign: 'center', color: '#b71c1c' }}>
              {language === 'he' ? 'סוג הטבה לא נתמך בכתובת זו.' : 'Unsupported benefit type for this form.'}
            </p>
          )}

          <div className="form-section renewal-section renewal-section-unified">
            <h2>{t.sectionRenewal}</h2>
            <p className="renewal-hint">{t.reminderBannerText}</p>
            {renewalAddedToCalendar ? (
              <p className="renewal-added-msg">{t.renewalAddedLabel}</p>
            ) : (
              <>
                <p className="renewal-required-notice">{t.renewalRequiredFirst}</p>
                <button type="button" className="add-to-calendar-btn" onClick={handleAddToCalendar}>
                  {t.reminderBannerButton}
                </button>
              </>
            )}
          </div>

          {useExpandedFoodStampsForm && (
            <div className="form-section signature-section digital-signature-at-end">
              <h2>{t.labelDigitalSignatureBlock}</h2>
              <p className="signature-section-intro">{t.hintDigitalSignature}</p>
              <div className="signature-block">
                <p className="signature-pad-hint">{t.signaturePadHint}</p>
                <div
                  className="signature-pad-wrap"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  onTouchCancel={stopDrawing}
                >
                  <canvas
                    ref={canvasRef}
                    className="signature-pad-canvas"
                    width={SIGNATURE_PAD_WIDTH}
                    height={SIGNATURE_PAD_HEIGHT}
                  />
                </div>
                <button type="button" className="clear-signature-btn" onClick={clearSignature}>
                  {t.clearSignature}
                </button>
                <div className="form-group signatory-name-optional" style={{ marginTop: '1rem' }}>
                  <label htmlFor="signatoryName">{t.labelSignatoryName.replace(' *', '')}</label>
                  <input
                    type="text"
                    id="signatoryName"
                    name="signatoryName"
                    value={formData.signatoryName}
                    onChange={handleChange}
                    placeholder={t.placeholderSignatoryName}
                    className="signatory-input"
                  />
                </div>
                <div className="signatory-date-row">
                  <span className="signatory-date-label">{t.labelSignatoryDate}</span>
                  <span className="signatory-date-value">
                    {new Date().toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="form-section signature-section">
            <h2>{t.sectionSignature}</h2>
            <p className="signature-section-intro">{t.sectionSignatureIntro}</p>
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="signature"
                name="signature"
                checked={formData.signature}
                onChange={handleChange}
                required
              />
              <label htmlFor="signature">{t.checkboxLabel}</label>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={() => navigate(-1)} className="cancel-button">
              {t.cancel}
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={loading || !renewalAddedToCalendar || !useExpandedFoodStampsForm}
            >
              {loading ? t.submitLoading : t.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CaseForm;
