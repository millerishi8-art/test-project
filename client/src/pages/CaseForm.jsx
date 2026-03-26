import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { caseFormTranslations } from '../translations/caseForm';
import { buildGoogleCalendarUrl, openGoogleCalendarInNewTab } from '../utils/googleCalendar';
import { buildCountrySelectOptions } from '../utils/countryOptions';
import './CaseForm.css';

const SIGNATURE_PAD_WIDTH = 400;
const SIGNATURE_PAD_HEIGHT = 160;

const UPLOAD_CATEGORY_TO_FIELD_KEY = {
  birth: 'doc_birth',
  ssn: 'doc_ssn',
  passport: 'doc_passport',
  marriage_certificate_us: 'doc_marriage',
  payment: 'doc_payment',
};

const CHILD_PATCH_TO_ERROR_KEY = {
  passportImage: 'passport',
  ssnImage: 'ssn',
  age: 'age',
  dob: 'dob',
  schoolClass: 'class',
  medicalFormsImage: 'medicalForms',
};

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
    additionalCitizenshipCountry: '',
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
  const { token, user, refreshUser } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const t = caseFormTranslations[language];
  const deferredPaymentOk = !!user?.deferredPaymentApproved;
  const deferredPaymentPending = !!user?.deferredPaymentRequestPending && !deferredPaymentOk;
  const deferredDeadlineFormatted = useMemo(() => {
    const iso = user?.deferredPaymentDeadline;
    if (!iso || !user?.deferredPaymentApproved) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [user?.deferredPaymentDeadline, user?.deferredPaymentApproved, language]);
  const canvasRef = useRef(null);
  const countryOptions = useMemo(() => buildCountrySelectOptions(language), [language]);

  const [formData, setFormData] = useState(() => getFormDataForBenefitType());
  /** @type {{ id: string, data: string, category?: string }[]} */
  const [attachments, setAttachments] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [error, setError] = useState('');
  /** @type {Record<string, string>} */
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingBenefit, setLoadingBenefit] = useState(true);
  const [benefit, setBenefit] = useState(null);
  const [renewalAddedToCalendar, setRenewalAddedToCalendar] = useState(false);
  const [familyChildren, setFamilyChildren] = useState([]);
  /** @type {{ passportImage: string, ssnImage: string, healthStatus: string } | null} */
  const [spouseBlock, setSpouseBlock] = useState(null);
  const [deferPaymentLoading, setDeferPaymentLoading] = useState(false);
  const [deferPaymentNotice, setDeferPaymentNotice] = useState('');

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshUser?.();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refreshUser]);

  useEffect(() => {
    setFormData(getFormDataForBenefitType());
    setAttachments([]);
    setFamilyChildren([]);
    setSpouseBlock(null);
    setRenewalAddedToCalendar(false);
    setError('');
    setFieldErrors({});
    setDeferPaymentNotice('');
  }, [type]);

  const clearFieldErrorKey = (key) => {
    if (!key) return;
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const requestDeferredPayment = async () => {
    if (!token) {
      setError(t.errorLoginRequired);
      return;
    }
    setDeferPaymentLoading(true);
    setDeferPaymentNotice('');
    setError('');
    try {
      const res = await axios.post(
        '/cases/defer-payment-request',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshUser?.();
      if (res.data?.emailSent === false) {
        setDeferPaymentNotice(t.deferPaymentEmailFailed);
      } else {
        setDeferPaymentNotice(t.deferPaymentRequestSent);
      }
    } catch (err) {
      const msg = err.response?.data?.error;
      setDeferPaymentNotice(typeof msg === 'string' ? msg : t.deferPaymentRequestError);
    } finally {
      setDeferPaymentLoading(false);
    }
  };

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
          clearFieldErrorKey('signaturePad');
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
    clearFieldErrorKey('signaturePad');
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
    setFormData((prev) => {
      const next = { ...prev, [name]: inputType === 'checkbox' ? checked : value };
      if (name === 'additionalCitizenship' && value === 'No') {
        next.additionalCitizenshipCountry = '';
      }
      return next;
    });
    if (name) clearFieldErrorKey(name);
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
    Object.keys(patch).forEach((k) => {
      const suf = CHILD_PATCH_TO_ERROR_KEY[k];
      if (suf) clearFieldErrorKey(`child_${childId}_${suf}`);
    });
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
    clearFieldErrorKey(field === 'passportImage' ? 'spouse_passport' : 'spouse_ssn');
    e.target.value = '';
    setError('');
  };

  const updateSpouseBlock = (patch) => {
    setSpouseBlock((prev) => (prev ? { ...prev, ...patch } : prev));
    if (Object.prototype.hasOwnProperty.call(patch, 'healthStatus')) clearFieldErrorKey('spouse_health');
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
    const fk = UPLOAD_CATEGORY_TO_FIELD_KEY[category];
    if (fk) clearFieldErrorKey(fk);
    e.target.value = '';
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => {
      const next = prev.filter((a) => a.id !== id);
      setTimeout(() => {
        setFieldErrors((fe) => {
          const n = { ...fe };
          if (!next.some((a) => a.category === 'birth')) delete n.doc_birth;
          if (!next.some((a) => a.category === 'ssn')) delete n.doc_ssn;
          if (!next.some((a) => a.category === 'passport')) delete n.doc_passport;
          if (!next.some((a) => a.category === 'marriage_certificate_us')) delete n.doc_marriage;
          if (!next.some((a) => a.category === 'payment')) delete n.doc_payment;
          return n;
        });
      }, 0);
      return next;
    });
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
    clearFieldErrorKey('renewalCalendar');
  };

  const doActualSubmit = async () => {
    setError('');
    setFieldErrors({});
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
      const data = err.response?.data;
      const msg = data?.error;
      const errCode = data?.code;
      if (status === 401) {
        setError(t.errorSessionExpired);
      } else if (status === 403) {
        setError(msg || t.errorNoPermission);
      } else if (!err.response) {
        setError(t.errorServerDown);
      } else if (errCode === 'CITIZENSHIP_COUNTRY_REQUIRED') {
        setError(t.errorCitizenshipCountryRequired);
      } else if (errCode === 'PAYMENT_PROOF_REQUIRED') {
        setError(typeof msg === 'string' ? msg : t.errorPaymentProofRequired);
      } else if (status >= 500 || msg) {
        setError(msg || t.errorServerError);
      } else {
        setError(msg || t.errorSubmit);
      }
    } finally {
      setLoading(false);
    }
  };

  const buildFieldScrollOrder = () => {
    const childOrder = familyChildren.flatMap((c) => [
      `child_${c.id}_passport`,
      `child_${c.id}_ssn`,
      `child_${c.id}_age`,
      `child_${c.id}_dob`,
      `child_${c.id}_class`,
      `child_${c.id}_medicalForms`,
    ]);
    return [
      'fullName',
      'dob',
      'birthPlace',
      'address',
      'fatherName',
      'motherName',
      'maritalStatus',
      'dependentsCount',
      'additionalCitizenship',
      'additionalCitizenshipCountry',
      'caseEmail',
      'casePassword',
      'doc_birth',
      'doc_ssn',
      'doc_passport',
      ...(isFamilyCase ? ['doc_marriage'] : []),
      ...(deferredPaymentOk ? [] : ['doc_payment']),
      ...(isFamilyCase && spouseBlock ? ['spouse_passport', 'spouse_ssn', 'spouse_health'] : []),
      ...childOrder,
      'signaturePad',
      'dec1',
      'dec2',
      'dec3',
      'dec4',
      'finalSignature',
      'renewalCalendar',
    ];
  };

  const collectCaseFormFieldErrors = () => {
    const errs = {};
    const englishOnlyRegex = /^[A-Za-z0-9\s.,#'/-]+$/;

    if (!formData.fullName?.trim()) errs.fullName = t.errorFieldRequired;
    else if (!englishOnlyRegex.test(formData.fullName)) errs.fullName = t.errorEnglishOnly;

    if (!formData.dob) errs.dob = t.errorFieldRequired;
    if (!formData.birthPlace) errs.birthPlace = t.errorFieldRequired;

    if (!formData.address?.trim()) errs.address = t.errorFieldRequired;
    else if (!englishOnlyRegex.test(formData.address)) errs.address = t.errorEnglishOnly;

    if (!formData.fatherName?.trim()) errs.fatherName = t.errorFieldRequired;
    else if (!englishOnlyRegex.test(formData.fatherName)) errs.fatherName = t.errorEnglishOnly;

    if (!formData.motherName?.trim()) errs.motherName = t.errorFieldRequired;
    else if (!englishOnlyRegex.test(formData.motherName)) errs.motherName = t.errorEnglishOnly;

    if (!formData.maritalStatus) errs.maritalStatus = t.errorFieldRequired;
    if (formData.dependentsCount === '' || Number(formData.dependentsCount) < 0) {
      errs.dependentsCount = t.errorFieldRequired;
    }
    if (!formData.additionalCitizenship) errs.additionalCitizenship = t.errorFieldRequired;
    if (formData.additionalCitizenship === 'Yes' && !(formData.additionalCitizenshipCountry || '').trim()) {
      errs.additionalCitizenshipCountry = t.errorCitizenshipCountryRequired;
    }

    if (formData.previousCase || formData.activeCase) {
      const em = (formData.caseEmail || '').trim();
      const pw = (formData.casePassword || '').trim();
      if (!em) errs.caseEmail = t.errorFieldRequired;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) errs.caseEmail = t.errorCaseEmailInvalid;
      if (!pw) errs.casePassword = t.errorCasePasswordRequired;
    }

    if (!attachments.some((a) => a.category === 'birth')) errs.doc_birth = t.errorMissingBirthCerts;
    if (!attachments.some((a) => a.category === 'ssn')) errs.doc_ssn = t.errorMissingSSN;
    if (!attachments.some((a) => a.category === 'passport')) errs.doc_passport = t.errorMissingPassport;
    if (isFamilyCase && !attachments.some((a) => a.category === 'marriage_certificate_us')) {
      errs.doc_marriage = t.errorMissingAmericanMarriageCertificate;
    }
    if (!deferredPaymentOk && !attachments.some((a) => a.category === 'payment')) {
      errs.doc_payment = t.errorMissingPayment;
    }

    if (isFamilyCase && spouseBlock) {
      if (!spouseBlock.passportImage?.trim()) errs.spouse_passport = t.errorUploadRequired;
      if (!spouseBlock.ssnImage?.trim()) errs.spouse_ssn = t.errorUploadRequired;
      if (!(spouseBlock.healthStatus || '').trim()) errs.spouse_health = t.errorSpouseHealthRequired;
    }

    if (isFamilyCase && familyChildren.length > 0) {
      for (const c of familyChildren) {
        const ageOk = c.age !== '' && c.age != null && String(c.age).trim() !== '';
        const classOk = (c.schoolClass || '').trim().length > 0;
        if (!c.passportImage?.trim()) errs[`child_${c.id}_passport`] = t.errorUploadRequired;
        if (!c.ssnImage?.trim()) errs[`child_${c.id}_ssn`] = t.errorUploadRequired;
        if (!ageOk) errs[`child_${c.id}_age`] = t.errorFieldRequired;
        if (!c.dob) errs[`child_${c.id}_dob`] = t.errorFieldRequired;
        if (!classOk) errs[`child_${c.id}_class`] = t.errorFieldRequired;
        if ((c.medicalIssues || '').trim() && !c.medicalFormsImage?.trim()) {
          errs[`child_${c.id}_medicalForms`] = t.errorChildMedicalDocs;
        }
      }
    }

    if (!(formData.signatureImage || '').trim()) errs.signaturePad = t.errorDrawSignature;

    if (!formData.dec1) errs.dec1 = t.errorConfirmSignature;
    if (!formData.dec2) errs.dec2 = t.errorConfirmSignature;
    if (!formData.dec3) errs.dec3 = t.errorConfirmSignature;
    if (!formData.dec4) errs.dec4 = t.errorConfirmSignature;
    if (!formData.signature) errs.finalSignature = t.errorConfirmSignature;

    if (!renewalAddedToCalendar) errs.renewalCalendar = t.renewalRequiredFirst;

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!useExpandedFoodStampsForm) {
      setFieldErrors({});
      setError(t.errorFillRequired);
      return;
    }

    const errs = collectCaseFormFieldErrors();
    const errKeys = Object.keys(errs);

    if (errKeys.length > 0) {
      setFieldErrors(errs);
      setError(t.errorFormHasFieldErrors);
      const order = buildFieldScrollOrder();
      setTimeout(() => {
        for (const k of order) {
          if (errs[k]) {
            document.getElementById(`case-field-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      }, 100);
      return;
    }

    setFieldErrors({});

    if (!token) {
      setError(t.errorLoginRequired);
      return;
    }
    await doActualSubmit();
  };

  const benefitTitle =
    type && t.benefitTitles?.[type] ? t.benefitTitles[type] : benefit?.title;

  const inlineFieldError = (key) =>
    fieldErrors[key] ? (
      <p className="case-form-inline-error" role="alert">
        {fieldErrors[key]}
      </p>
    ) : null;
  const fgClass = (key) => (fieldErrors[key] ? 'form-group field-has-error' : 'form-group');

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
                <div className={fgClass('fullName')} id="case-field-fullName">
                  <label htmlFor="case-input-fullName">{t.labelFullName}</label>
                  <input
                    id="case-input-fullName"
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    placeholder={t.placeholderFullName}
                    dir="ltr"
                    autoComplete="name"
                    aria-invalid={Boolean(fieldErrors.fullName)}
                  />
                  {inlineFieldError('fullName')}
                </div>
                <div className={fgClass('dob')} id="case-field-dob">
                  <label htmlFor="case-input-dob">{t.labelDob}</label>
                  <input
                    id="case-input-dob"
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                    required
                    aria-invalid={Boolean(fieldErrors.dob)}
                  />
                  {inlineFieldError('dob')}
                </div>
                <div className={fgClass('birthPlace')} id="case-field-birthPlace">
                  <label htmlFor="case-input-birthPlace">{t.labelBirthPlace}</label>
                  <select
                    id="case-input-birthPlace"
                    name="birthPlace"
                    value={formData.birthPlace}
                    onChange={handleChange}
                    required
                    aria-invalid={Boolean(fieldErrors.birthPlace)}
                  >
                    <option value="Israel">{t.birthPlaceIsrael}</option>
                    <option value="New York">{t.birthPlaceNY}</option>
                    <option value="Other">{t.birthPlaceOther}</option>
                  </select>
                  {inlineFieldError('birthPlace')}
                </div>
                <div className={fgClass('address')} id="case-field-address">
                  <label htmlFor="case-input-address">{t.labelAddress}</label>
                  <textarea
                    id="case-input-address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows="3"
                    required
                    placeholder={t.placeholderAddress}
                    dir="ltr"
                    aria-invalid={Boolean(fieldErrors.address)}
                  />
                  {inlineFieldError('address')}
                </div>
                <div className="form-group">
                  <label>{t.labelParentalDetails}</label>
                  <div className={`nested-group ${fieldErrors.fatherName || fieldErrors.motherName ? 'nested-has-error' : ''}`}>
                    <div className={fgClass('fatherName')} id="case-field-fatherName">
                      <label htmlFor="case-input-fatherName">{t.labelFatherName}</label>
                      <input
                        id="case-input-fatherName"
                        type="text"
                        name="fatherName"
                        value={formData.fatherName}
                        onChange={handleChange}
                        required
                        placeholder={t.placeholderFatherName}
                        dir="ltr"
                        aria-invalid={Boolean(fieldErrors.fatherName)}
                      />
                      {inlineFieldError('fatherName')}
                    </div>
                    <div className={fgClass('motherName')} id="case-field-motherName" style={{ marginTop: '15px' }}>
                      <label htmlFor="case-input-motherName">{t.labelMotherName}</label>
                      <input
                        id="case-input-motherName"
                        type="text"
                        name="motherName"
                        value={formData.motherName}
                        onChange={handleChange}
                        required
                        placeholder={t.placeholderMotherName}
                        dir="ltr"
                        aria-invalid={Boolean(fieldErrors.motherName)}
                      />
                      {inlineFieldError('motherName')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h2>{t.sectionFamily}</h2>
                <div className={fgClass('maritalStatus')} id="case-field-maritalStatus">
                  <label htmlFor="case-input-maritalStatus">{t.labelMaritalStatus}</label>
                  <select
                    id="case-input-maritalStatus"
                    name="maritalStatus"
                    value={formData.maritalStatus}
                    onChange={handleChange}
                    required
                    aria-invalid={Boolean(fieldErrors.maritalStatus)}
                  >
                    <option value="Single">{t.maritalSingle}</option>
                    <option value="Married living with spouse">{t.maritalMarriedSpouse}</option>
                    <option value="Married living with spouse & children">{t.maritalMarriedChildren}</option>
                  </select>
                  {inlineFieldError('maritalStatus')}
                </div>
                <div className={fgClass('dependentsCount')} id="case-field-dependentsCount">
                  <label htmlFor="case-input-dependentsCount">{t.labelDependents}</label>
                  <input
                    id="case-input-dependentsCount"
                    type="number"
                    name="dependentsCount"
                    value={formData.dependentsCount}
                    onChange={handleChange}
                    min="0"
                    required
                    placeholder={t.placeholderDependents}
                    aria-invalid={Boolean(fieldErrors.dependentsCount)}
                  />
                  {inlineFieldError('dependentsCount')}
                </div>
                <div className={fgClass('additionalCitizenship')} id="case-field-additionalCitizenship">
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
                  {inlineFieldError('additionalCitizenship')}
                  {formData.additionalCitizenship === 'Yes' && (
                    <div
                      className={fgClass('additionalCitizenshipCountry')}
                      id="case-field-additionalCitizenshipCountry"
                      style={{ marginTop: '15px' }}
                    >
                      <label htmlFor="case-select-additionalCitizenshipCountry">
                        {t.labelCitizenshipCountrySelect}
                      </label>
                      <select
                        id="case-select-additionalCitizenshipCountry"
                        name="additionalCitizenshipCountry"
                        value={formData.additionalCitizenshipCountry}
                        onChange={handleChange}
                        required={formData.additionalCitizenship === 'Yes'}
                        aria-invalid={Boolean(fieldErrors.additionalCitizenshipCountry)}
                      >
                        <option value="">{t.placeholderCitizenshipCountrySelect}</option>
                        {countryOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {inlineFieldError('additionalCitizenshipCountry')}
                    </div>
                  )}
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
                    <div className={fgClass('caseEmail')} id="case-field-caseEmail" style={{ marginTop: '10px' }}>
                      <label htmlFor="case-input-caseEmail">{t.labelCaseEmail}</label>
                      <input
                        id="case-input-caseEmail"
                        type="email"
                        name="caseEmail"
                        value={formData.caseEmail}
                        onChange={handleChange}
                        placeholder={t.placeholderCaseEmail}
                        dir="ltr"
                        aria-invalid={Boolean(fieldErrors.caseEmail)}
                      />
                      {inlineFieldError('caseEmail')}
                    </div>
                    <div className={fgClass('casePassword')} id="case-field-casePassword" style={{ marginTop: '10px' }}>
                      <label htmlFor="case-input-casePassword">{t.labelCasePassword}</label>
                      <input
                        id="case-input-casePassword"
                        type="password"
                        name="casePassword"
                        value={formData.casePassword}
                        onChange={handleChange}
                        placeholder={t.placeholderCasePassword}
                        dir="ltr"
                        aria-invalid={Boolean(fieldErrors.casePassword)}
                      />
                      {inlineFieldError('casePassword')}
                    </div>
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
                    <div
                      id="case-field-doc_birth"
                      className={`case-form-doc-block ${fieldErrors.doc_birth ? 'field-has-error' : ''}`}
                      style={{ width: '100%' }}
                    >
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
                      {inlineFieldError('doc_birth')}
                    </div>

                    <div
                      id="case-field-doc_ssn"
                      className={`case-form-doc-block ${fieldErrors.doc_ssn ? 'field-has-error' : ''}`}
                      style={{ width: '100%' }}
                    >
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
                      {inlineFieldError('doc_ssn')}
                    </div>

                    <div
                      id="case-field-doc_passport"
                      className={`case-form-doc-block ${fieldErrors.doc_passport ? 'field-has-error' : ''}`}
                      style={{ width: '100%' }}
                    >
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
                      {inlineFieldError('doc_passport')}
                    </div>

                    {isFamilyCase && (
                      <div
                        id="case-field-doc_marriage"
                        className={`case-form-doc-block ${fieldErrors.doc_marriage ? 'field-has-error' : ''}`}
                        style={{ width: '100%' }}
                      >
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
                        {inlineFieldError('doc_marriage')}
                      </div>
                    )}

                    <div
                      id="case-field-doc_payment"
                      className={`case-form-doc-block ${fieldErrors.doc_payment ? 'field-has-error' : ''}`}
                      style={{ width: '100%' }}
                    >
                      {deferredPaymentOk && (
                        <div className="case-form-defer-commitment-banner" role="status">
                          <p className="case-form-defer-commitment-title">{t.deferPaymentCommitmentTitle}</p>
                          <p className="case-form-defer-commitment-text">
                            {deferredDeadlineFormatted
                              ? t.deferPaymentCommitment.replace('{{date}}', deferredDeadlineFormatted)
                              : t.deferPaymentCommitmentFallback}
                          </p>
                        </div>
                      )}
                      {deferredPaymentPending && (
                        <p className="case-form-defer-pending-note">{t.deferPaymentPendingNote}</p>
                      )}
                      <label className="document-type-label" style={{ display: 'block', marginBottom: '5px' }}>
                        {deferredPaymentOk ? t.labelProofOfPaymentOptional : t.labelProofOfPayment}
                      </label>
                      <p className="upload-field-hint">
                        {deferredPaymentOk ? t.hintProofOfPaymentDeferred : t.hintProofOfPayment}
                      </p>
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
                      {inlineFieldError('doc_payment')}
                      {!deferredPaymentOk && !deferredPaymentPending && (
                        <button
                          type="button"
                          className="case-form-defer-payment-btn"
                          onClick={requestDeferredPayment}
                          disabled={deferPaymentLoading}
                        >
                          {deferPaymentLoading ? t.deferPaymentSending : t.deferPaymentButton}
                        </button>
                      )}
                      {deferPaymentNotice ? (
                        <p className="case-form-defer-notice">{deferPaymentNotice}</p>
                      ) : null}
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
                      <div className={fgClass('spouse_passport')} id="case-field-spouse_passport">
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
                        {inlineFieldError('spouse_passport')}
                      </div>
                      <div className={fgClass('spouse_ssn')} id="case-field-spouse_ssn">
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
                        {inlineFieldError('spouse_ssn')}
                      </div>
                      <div className={fgClass('spouse_health')} id="case-field-spouse_health">
                        <label htmlFor="spouse-health-status">{t.labelSpouseHealth}</label>
                        <p className="upload-field-hint">{t.hintSpouseHealth}</p>
                        <textarea
                          id="spouse-health-status"
                          rows={4}
                          value={spouseBlock.healthStatus}
                          onChange={(e) => updateSpouseBlock({ healthStatus: e.target.value })}
                          placeholder={t.placeholderSpouseHealth}
                          aria-invalid={Boolean(fieldErrors.spouse_health)}
                        />
                        {inlineFieldError('spouse_health')}
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
                      <div
                        className={fgClass(`child_${child.id}_passport`)}
                        id={`case-field-child_${child.id}_passport`}
                      >
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
                        {inlineFieldError(`child_${child.id}_passport`)}
                      </div>
                      <div
                        className={fgClass(`child_${child.id}_ssn`)}
                        id={`case-field-child_${child.id}_ssn`}
                      >
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
                        {inlineFieldError(`child_${child.id}_ssn`)}
                      </div>
                      <div
                        className={fgClass(`child_${child.id}_age`)}
                        id={`case-field-child_${child.id}_age`}
                      >
                        <label htmlFor={`child-age-${child.id}`}>{t.labelChildAge}</label>
                        <input
                          id={`child-age-${child.id}`}
                          type="number"
                          min="0"
                          max="25"
                          value={child.age}
                          onChange={(e) => updateFamilyChild(child.id, { age: e.target.value })}
                          placeholder={t.placeholderChildAge}
                          aria-invalid={Boolean(fieldErrors[`child_${child.id}_age`])}
                        />
                        {inlineFieldError(`child_${child.id}_age`)}
                      </div>
                      <div
                        className={fgClass(`child_${child.id}_dob`)}
                        id={`case-field-child_${child.id}_dob`}
                      >
                        <label htmlFor={`child-dob-${child.id}`}>{t.labelChildDob}</label>
                        <input
                          id={`child-dob-${child.id}`}
                          type="date"
                          value={child.dob}
                          onChange={(e) => updateFamilyChild(child.id, { dob: e.target.value })}
                          aria-invalid={Boolean(fieldErrors[`child_${child.id}_dob`])}
                        />
                        {inlineFieldError(`child_${child.id}_dob`)}
                      </div>
                      <div
                        className={fgClass(`child_${child.id}_class`)}
                        id={`case-field-child_${child.id}_class`}
                      >
                        <label htmlFor={`child-class-${child.id}`}>{t.labelChildSchoolClass}</label>
                        <input
                          id={`child-class-${child.id}`}
                          type="text"
                          value={child.schoolClass}
                          onChange={(e) => updateFamilyChild(child.id, { schoolClass: e.target.value })}
                          placeholder={t.placeholderChildSchoolClass}
                          aria-invalid={Boolean(fieldErrors[`child_${child.id}_class`])}
                        />
                        {inlineFieldError(`child_${child.id}_class`)}
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
                      <div
                        className={fgClass(`child_${child.id}_medicalForms`)}
                        id={`case-field-child_${child.id}_medicalForms`}
                      >
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
                        {inlineFieldError(`child_${child.id}_medicalForms`)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="form-section declarations-section">
                <h2>{t.sectionDeclarations}</h2>
                <div
                  id="case-field-dec1"
                  className={`checkbox-group${fieldErrors.dec1 ? ' field-has-error' : ''}`}
                >
                  <input type="checkbox" id="dec1" name="dec1" checked={formData.dec1} onChange={handleChange} required />
                  <label htmlFor="dec1">{t.dec1}</label>
                  {inlineFieldError('dec1')}
                </div>
                <div
                  id="case-field-dec2"
                  className={`checkbox-group${fieldErrors.dec2 ? ' field-has-error' : ''}`}
                >
                  <input type="checkbox" id="dec2" name="dec2" checked={formData.dec2} onChange={handleChange} required />
                  <label htmlFor="dec2">{t.dec2}</label>
                  {inlineFieldError('dec2')}
                </div>
                <div
                  id="case-field-dec3"
                  className={`checkbox-group${fieldErrors.dec3 ? ' field-has-error' : ''}`}
                >
                  <input type="checkbox" id="dec3" name="dec3" checked={formData.dec3} onChange={handleChange} required />
                  <label htmlFor="dec3">{t.dec3}</label>
                  {inlineFieldError('dec3')}
                </div>
                <div
                  id="case-field-dec4"
                  className={`checkbox-group${fieldErrors.dec4 ? ' field-has-error' : ''}`}
                >
                  <input type="checkbox" id="dec4" name="dec4" checked={formData.dec4} onChange={handleChange} required />
                  <label htmlFor="dec4">{t.dec4}</label>
                  {inlineFieldError('dec4')}
                </div>
              </div>
            </>
          ) : (
            <p className="form-subtitle" style={{ textAlign: 'center', color: '#b71c1c' }}>
              {language === 'he' ? 'סוג הטבה לא נתמך בכתובת זו.' : 'Unsupported benefit type for this form.'}
            </p>
          )}

          <div
            id="case-field-renewalCalendar"
            className={`form-section renewal-section renewal-section-unified${fieldErrors.renewalCalendar ? ' renewal-section-has-error' : ''}`}
          >
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
            {inlineFieldError('renewalCalendar')}
          </div>

          {useExpandedFoodStampsForm && (
            <div className="form-section signature-section digital-signature-at-end">
              <h2>{t.labelDigitalSignatureBlock}</h2>
              <p className="signature-section-intro">{t.hintDigitalSignature}</p>
              <div className="signature-block">
                <p className="signature-pad-hint">{t.signaturePadHint}</p>
                <div
                  id="case-field-signaturePad"
                  className={`signature-pad-wrap${fieldErrors.signaturePad ? ' field-has-error' : ''}`}
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
                {inlineFieldError('signaturePad')}
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
            <div
              id="case-field-finalSignature"
              className={`checkbox-group${fieldErrors.finalSignature ? ' field-has-error' : ''}`}
            >
              <input
                type="checkbox"
                id="signature"
                name="signature"
                checked={formData.signature}
                onChange={handleChange}
                required
              />
              <label htmlFor="signature">{t.checkboxLabel}</label>
              {inlineFieldError('finalSignature')}
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
