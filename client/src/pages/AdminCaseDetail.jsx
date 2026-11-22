import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext.jsx';
import CaseStatusModal from '../components/CaseStatusModal.jsx';
import { DocumentImage, ImageLightbox, useImageRotation } from '../components/RotatableImage.jsx';
import { getCaseStageToneClass, shortStageLabel } from '../utils/caseProcessingStages';
import ShareCaseButton from '../components/ShareCaseButton.jsx';
import CreditAgreementSheet from '../components/CreditAgreementSheet';
import { idDocLabel } from '../data/creditAgreement';
import { compressImageFile } from '../utils/imageCompression';
import '../styles/caseStageTones.css';
import './AdminCaseDetail.css';

const benefitTitles = {
  family: 'משפחה (כולל הורה וילדים מתחת לגיל 18)',
  individual: 'בגיר מעל 21',
  minor: 'צעיר',
  card_order: 'הזמנת כרטיס',
  credit_agreement: 'הטבה לשימוש מסגרת האשראי',
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

const ADDED_MEMBER_ROLES = [
  { id: 'child', label: 'ילד', addLabel: '+ ילד' },
  { id: 'guardian', label: 'אפוטרופוס', addLabel: '+ אפוטרופוס' },
  { id: 'spouse', label: 'בן/בת זוג', addLabel: '+ בן/בת זוג' },
];

const ADDED_MEMBER_ROLE_LABEL = {
  ...Object.fromEntries(ADDED_MEMBER_ROLES.map((role) => [role.id, role.label])),
  man: 'איש',
  woman: 'אישה',
};

const ADDED_MEMBER_FIELDS = [
  ['fullName', 'שם מלא'],
  ['dob', 'תאריך לידה'],
  ['birthPlace', 'מקום לידה'],
  ['fatherName', 'שם האב'],
  ['motherName', 'שם האם'],
  ['maritalStatus', 'מצב משפחתי'],
  ['additionalCitizenshipCountry', 'אזרחות נוספת (קוד מדינה)'],
];

function newAddedMember(role) {
  return {
    id: `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    fullName: '',
    dob: '',
    birthPlace: '',
    fatherName: '',
    motherName: '',
    maritalStatus: '',
    additionalCitizenshipCountry: '',
    notes: '',
    images: [],
    imageUploading: false,
    imageError: '',
  };
}

function memberImagesFromRaw(member) {
  const rawImages = Array.isArray(member?.images) ? member.images : [];
  const urls = Array.isArray(member?.imageUrls) ? member.imageUrls : [];
  return rawImages
    .map((item, index) => {
      const path = typeof item === 'string' ? item.trim() : String(item?.path || '').trim();
      if (!path) return null;
      return { path, preview: String(urls[index] || '').trim() };
    })
    .filter(Boolean)
    .slice(0, 12);
}

function memberImageViewUrl(image) {
  const preview = String(image?.preview || '').trim();
  if (/^(https?:|blob:|data:)/i.test(preview)) return preview;
  const path = String(image?.path || '').trim();
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return '';
}

function MemberStoredImage({ caseId, storagePath, src, alt, turn, onOpen, onRotate, onDownload, downloadBusy, onRemove, removeBusy }) {
  const direct = memberImageViewUrl({ preview: src, path: src });
  const [blobUrl, setBlobUrl] = useState('');

  useEffect(() => {
    if (direct || !storagePath || !caseId) {
      setBlobUrl('');
      return undefined;
    }
    let cancelled = false;
    let created = '';
    axios
      .get(`/admin/cases/${caseId}/media`, {
        params: { path: storagePath },
        responseType: 'blob',
      })
      .then((res) => {
        if (cancelled) return;
        created = URL.createObjectURL(res.data);
        setBlobUrl(created);
      })
      .catch(() => {
        if (!cancelled) setBlobUrl('');
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [caseId, storagePath, direct]);

  const view = direct || blobUrl;
  if (!view) {
    return <p className="admin-case-member-drop-hint">{storagePath ? 'טוען תמונה...' : ''}</p>;
  }
  if (urlLooksLikePdf(view) || urlLooksLikePdf(storagePath)) {
    return (
      <div>
        <a className="admin-case-detail-pdf-open-link" href={view} target="_blank" rel="noopener noreferrer">
          {alt} – PDF
        </a>
        {onDownload ? (
          <button type="button" className="image-download-btn" onClick={onDownload} disabled={downloadBusy}>
            {downloadBusy ? 'מוריד...' : 'הורדה למחשב'}
          </button>
        ) : null}
        {onRemove ? (
          <button type="button" className="image-remove-btn" onClick={onRemove} disabled={removeBusy}>
            {removeBusy ? 'מסיר...' : 'הסרת תמונה'}
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <DocumentImage
      src={view}
      alt={alt}
      className="admin-case-detail-uploaded-img"
      turn={turn}
      onOpen={() => onOpen(view)}
      onRotate={(direction) => onRotate(view, direction)}
      onDownload={onDownload}
      downloadBusy={downloadBusy}
      onRemove={onRemove}
      removeBusy={removeBusy}
    />
  );
}

function isUploadableMemberFile(file) {
  if (!file) return false;
  if (file.type && (file.type.startsWith('image/') || file.type === 'application/pdf')) return true;
  return /\.(png|jpe?g|gif|webp|heic|heif|bmp|pdf)$/i.test(file.name || '');
}

function membersFromCase(pd) {
  const raw = Array.isArray(pd?.addedMembers) ? pd.addedMembers : [];
  return raw
    .filter((member) => member && typeof member === 'object' && ADDED_MEMBER_ROLE_LABEL[member.role])
    .map((member, index) => ({
      id: String(member.id || `saved_${index}`),
      role: member.role,
      fullName: String(member.fullName || ''),
      dob: String(member.dob || ''),
      birthPlace: String(member.birthPlace || ''),
      fatherName: String(member.fatherName || ''),
      motherName: String(member.motherName || ''),
      maritalStatus: String(member.maritalStatus || ''),
      additionalCitizenshipCountry: String(member.additionalCitizenshipCountry || ''),
      notes: String(member.notes || ''),
      images: memberImagesFromRaw(member),
      imageUploading: false,
      imageError: '',
    }));
}

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

function downloadFileName(label, storagePath) {
  const match = String(storagePath || '').match(/\.([a-z0-9]{2,5})$/i);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  const base = String(label || 'תמונה').replace(/[\\/:*?"<>|]/g, '').trim() || 'תמונה';
  return `${base}.${ext}`;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function normalizeAttachmentRows(caseData) {
  const meta = Array.isArray(caseData?.attachmentMeta) ? caseData.attachmentMeta : [];
  if (meta.length > 0) {
    return meta
      .map((m, idx) => ({
        id: `meta_${idx}`,
        category: String(m?.category || 'general'),
        url: mediaFieldToUrl(m?.path),
        storagePath: String(m?.storagePath || ''),
      }))
      .filter((r) => !!r.url);
  }
  const att = Array.isArray(caseData?.attachments) ? caseData.attachments : [];
  return att
    .map((a, idx) => ({
      id: `att_${idx}`,
      category: 'general',
      url: mediaFieldToUrl(a),
      storagePath: String(caseData?.attachmentStoragePaths?.[idx] || ''),
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
  const { user: sessionUser } = useAuth();
  const sessionEmail = String(sessionUser?.email || '').trim().toLowerCase();
  const canEditSubmittedText =
    sessionUser?.isPrimaryAdmin === true &&
    sessionUser?.canEditSubmittedText === true &&
    sessionEmail !== 'yudigruenberg@gmail.com';
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [textDraft, setTextDraft] = useState(null);
  const [textSaving, setTextSaving] = useState(false);
  const [textError, setTextError] = useState('');
  const [confirmingCompleted, setConfirmingCompleted] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const { turnOf, rotate } = useImageRotation();
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [downloadState, setDownloadState] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [removingPath, setRemovingPath] = useState('');
  const [imageDropMemberId, setImageDropMemberId] = useState('');

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

  const startTextEdit = (roleToAdd) => {
    const pd = caseData?.personalDetails && typeof caseData.personalDetails === 'object' ? caseData.personalDetails : {};
    const addedMembers = membersFromCase(pd);
    if (typeof roleToAdd === 'string' && ADDED_MEMBER_ROLE_LABEL[roleToAdd]) {
      addedMembers.push(newAddedMember(roleToAdd));
    }
    setTextDraft({
      address: caseData?.address || pd.address || '',
      fullName: pd.fullName || '',
      dob: pd.dob || '',
      birthPlace: pd.birthPlace || '',
      fatherName: pd.fatherName || '',
      motherName: pd.motherName || '',
      maritalStatus: pd.maritalStatus || '',
      dependentsCount: pd.dependentsCount != null ? String(pd.dependentsCount) : '',
      additionalCitizenshipCountry: pd.additionalCitizenshipCountry || '',
      adultsOnlyAddress: pd.adultsOnlyAddress || '',
      familyBackground: caseData?.familyBackground || '',
      addedMembers,
    });
    setTextError('');
    setEditingText(true);
  };

  const handleTextDraftChange = (key, value) => {
    setTextDraft((prev) => ({ ...prev, [key]: value }));
  };

  const beginAddMember = (role) => {
    if (editingText) {
      setTextDraft((prev) =>
        prev ? { ...prev, addedMembers: [...(prev.addedMembers || []), newAddedMember(role)] } : prev
      );
      return;
    }
    startTextEdit(role);
  };

  const updateDraftMember = (id, key, value) => {
    setTextDraft((prev) => ({
      ...prev,
      addedMembers: (prev?.addedMembers || []).map((member) =>
        member.id === id ? { ...member, [key]: value } : member
      ),
    }));
  };

  const removeDraftMember = (id) => {
    setTextDraft((prev) => ({
      ...prev,
      addedMembers: (prev?.addedMembers || []).filter((member) => member.id !== id),
    }));
  };

  const removeMemberImage = (memberId, path) => {
    setTextDraft((prev) => ({
      ...prev,
      addedMembers: (prev?.addedMembers || []).map((member) => {
        if (member.id !== memberId) return member;
        const removed = (member.images || []).find((image) => image.path === path);
        if (removed?.preview?.startsWith('blob:')) URL.revokeObjectURL(removed.preview);
        return {
          ...member,
          images: (member.images || []).filter((image) => image.path !== path),
        };
      }),
    }));
  };

  const uploadMemberImages = async (memberId, fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const currentCount =
      textDraft?.addedMembers?.find((member) => member.id === memberId)?.images?.length || 0;
    const room = Math.max(0, 12 - currentCount);
    if (!room) {
      updateDraftMember(memberId, 'imageError', 'אפשר לצרף עד 12 תמונות לאדם.');
      return;
    }
    updateDraftMember(memberId, 'imageUploading', true);
    updateDraftMember(memberId, 'imageError', '');
    const uploaded = [];
    let error = '';
    for (const file of files.slice(0, room)) {
      if (!isUploadableMemberFile(file)) {
        error = 'אפשר להעלות תמונה או PDF.';
        continue;
      }
      try {
        const data = await compressImageFile(file);
        const res = await axios.post('/cases/upload-attachment', {
          data,
          category: 'added-member',
          fileName: file.name || 'photo',
        });
        const path = String(res.data?.path || '').trim();
        if (!path) throw new Error('missing path');
        uploaded.push({ path, preview: URL.createObjectURL(file) });
      } catch {
        error = 'העלאת התמונה נכשלה. נסו שוב.';
      }
    }
    setTextDraft((prev) => ({
      ...prev,
      addedMembers: (prev?.addedMembers || []).map((member) => {
        if (member.id !== memberId) return member;
        return {
          ...member,
          images: [...(member.images || []), ...uploaded].slice(0, 12),
          imageUploading: false,
          imageError: error,
        };
      }),
    }));
  };

  const saveTextEdit = async (e) => {
    e.preventDefault();
    if (!textDraft || textSaving) return;
    const address = String(textDraft.address || '').trim();
    if (!address) {
      setTextError('כתובת למשלוח הכרטיס לא יכולה להיות ריקה.');
      return;
    }
    const addedMembers = Array.isArray(textDraft.addedMembers) ? textDraft.addedMembers : [];
    const nameless = addedMembers.find((member) => !String(member.fullName || '').trim());
    if (nameless) {
      setTextError('נא למלא שם מלא לכל אדם שנוסף.');
      return;
    }
    if (addedMembers.some((member) => member.imageUploading)) {
      setTextError('ממתינים לסיום העלאת התמונות.');
      return;
    }
    setTextSaving(true);
    setTextError('');
    try {
      const res = await axios.patch(`/admin/cases/${caseId}/form-text`, {
        address,
        familyBackground: textDraft.familyBackground,
        personalDetails: {
          fullName: textDraft.fullName,
          dob: textDraft.dob,
          birthPlace: textDraft.birthPlace,
          fatherName: textDraft.fatherName,
          motherName: textDraft.motherName,
          maritalStatus: textDraft.maritalStatus,
          dependentsCount: textDraft.dependentsCount,
          additionalCitizenshipCountry: textDraft.additionalCitizenshipCountry,
          adultsOnlyAddress: textDraft.adultsOnlyAddress,
          addedMembers: addedMembers.map((member) => ({
            id: member.id,
            role: member.role,
            fullName: member.fullName,
            dob: member.dob,
            birthPlace: member.birthPlace,
            fatherName: member.fatherName,
            motherName: member.motherName,
            maritalStatus: member.maritalStatus,
            additionalCitizenshipCountry: member.additionalCitizenshipCountry,
            notes: member.notes,
            images: (member.images || [])
              .map((image) => (typeof image === 'string' ? image : image?.path))
              .filter(Boolean),
          })),
        },
      });
      setCaseData((prev) => (prev && res.data.case ? { ...prev, ...res.data.case } : res.data.case || prev));
      setEditingText(false);
      setTextDraft(null);
    } catch (err) {
      setTextError(err.response?.data?.error || 'שגיאה בשמירת המלל');
    } finally {
      setTextSaving(false);
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
            חזרה לניהול תיקי לקוחות
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
    if (String(row.category || '').startsWith('added_')) return;
    if (Object.prototype.hasOwnProperty.call(mainDocs, row.category)) {
      mainDocs[row.category].push(row);
      return;
    }
    mainDocs.general.push(row);
  });
  const familyChildren = Array.isArray(c?.personalDetails?.familyChildren) ? c.personalDetails.familyChildren : [];
  const savedAddedMembers = membersFromCase(c?.personalDetails).map((member) => {
    const extra = attachmentRows.filter((row) => row.category === `added_${member.id}` && row.storagePath);
    if (!extra.length) return member;
    const images = [...(member.images || [])];
    extra.forEach((row) => {
      const existing = images.find((image) => image.path === row.storagePath);
      if (existing) {
        if (!existing.preview && memberImageViewUrl({ preview: row.url })) existing.preview = row.url;
        return;
      }
      images.push({
        path: row.storagePath,
        preview: memberImageViewUrl({ preview: row.url }),
      });
    });
    return { ...member, images };
  });

  const downloadStoredFile = async (storagePath, filename) => {
    if (!storagePath || downloadState) return;
    setDownloadState(storagePath);
    setDownloadError('');
    try {
      const res = await axios.get(`/admin/cases/${caseId}/media`, {
        params: { path: storagePath },
        responseType: 'blob',
      });
      saveBlob(res.data, filename || downloadFileName('תמונה', storagePath));
    } catch {
      setDownloadError('ההורדה נכשלה. נסו שוב.');
    } finally {
      setDownloadState('');
    }
  };

  const downloadAllImages = async () => {
    if (downloadState) return;
    setDownloadState('all');
    setDownloadError('');
    try {
      const res = await axios.get(`/admin/cases/${caseId}/images.zip`, { responseType: 'blob' });
      saveBlob(res.data, 'תמונות-התיק.zip');
    } catch {
      setDownloadError('הורדת התמונות נכשלה. נסו שוב.');
    } finally {
      setDownloadState('');
    }
  };

  const renderDownloadButton = (storagePath, label) => {
    if (!storagePath) return null;
    return (
      <button
        type="button"
        className="image-download-btn"
        onClick={() => downloadStoredFile(storagePath, downloadFileName(label, storagePath))}
        disabled={Boolean(downloadState)}
      >
        {downloadState === storagePath ? 'מוריד...' : 'הורדה למחשב'}
      </button>
    );
  };

  const removeClientImage = async (storagePath, field) => {
    if (!canEditSubmittedText || removingPath) return;
    const path = String(storagePath || '').trim();
    const slot = field === 'idCardPhoto' || field === 'idCardAnnex' ? field : '';
    const key = path || slot;
    if (!key) return;
    if (!window.confirm('להסיר את התמונה מהתיק? היא תימחק ולא תופיע יותר.')) return;
    setRemovingPath(key);
    setDownloadError('');
    try {
      const res = await axios.delete(`/admin/cases/${caseId}/media`, {
        data: { path, field: slot },
      });
      setCaseData((prev) => (prev && res.data.case ? { ...prev, ...res.data.case } : res.data.case || prev));
      setEnlargedImage(null);
    } catch (err) {
      setDownloadError(err.response?.data?.error || 'הסרת התמונה נכשלה. נסו שוב.');
    } finally {
      setRemovingPath('');
    }
  };

  const renderRemoveButton = (storagePath, field) => {
    if (!canEditSubmittedText) return null;
    const path = String(storagePath || '').trim();
    const slot = field === 'idCardPhoto' || field === 'idCardAnnex' ? field : '';
    const key = path || slot;
    if (!key) return null;
    return (
      <button
        type="button"
        className="image-remove-btn"
        onClick={() => removeClientImage(path, slot)}
        disabled={Boolean(removingPath)}
      >
        {removingPath === key ? 'מסיר...' : 'הסרת תמונה'}
      </button>
    );
  };

  const renderMediaCard = (row, label, idx) => {
    const key = `${row.id}_${idx}`;
    if (urlLooksLikePdf(row.url)) {
      return (
        <div key={key} className="admin-case-detail-attachment-card admin-case-detail-attachment-pdf">
          <a className="admin-case-detail-pdf-open-link" href={row.url} target="_blank" rel="noopener noreferrer">
            {label} – PDF
          </a>
          {renderDownloadButton(row.storagePath, label)}
          {renderRemoveButton(row.storagePath || row.url)}
        </div>
      );
    }
    return (
      <DocumentImage
        key={key}
        src={row.url}
        alt={label}
        className="admin-case-detail-uploaded-img"
        turn={turnOf(row.url)}
        onOpen={() => setEnlargedImage(row.url)}
        onRotate={(direction) => rotate(row.url, direction)}
        onDownload={row.storagePath ? () => downloadStoredFile(row.storagePath, downloadFileName(label, row.storagePath)) : undefined}
        downloadBusy={downloadState === row.storagePath}
        onRemove={canEditSubmittedText ? () => removeClientImage(row.storagePath || row.url) : undefined}
        removeBusy={removingPath === (row.storagePath || row.url)}
      />
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

  const yesNoBadge = (val) => {
    if (val == null) return <span className="admin-case-detail-value">–</span>;
    const yes = val === true || val === 'true' || val === 'כן';
    return (
      <span className={`admin-case-yn ${yes ? 'is-yes' : 'is-no'}`}>
        {yes ? 'כן' : 'לא'}
      </span>
    );
  };

  const renderCardOrderDetails = (pd) => {
    const order = pd?.cardOrder && typeof pd.cardOrder === 'object' ? pd.cardOrder : {};
    const received = order.cardReceivedByMail === true || order.cardReceivedByMail === 'true';
    return (
      <div className="admin-case-detail-pd-structured admin-case-card-order">
        <div className="admin-case-detail-grid admin-case-card-order-grid">
          <div className="admin-case-detail-field">
            <span className="admin-case-detail-label">סוג בקשה</span>
            <span className="admin-case-detail-value">הזמנת כרטיס</span>
          </div>
          <div className="admin-case-detail-field">
            <span className="admin-case-detail-label">שם מלא</span>
            <span className="admin-case-detail-value">{pd?.fullName || '–'}</span>
          </div>
          <div className="admin-case-detail-field">
            <span className="admin-case-detail-label">טלפון</span>
            <span className="admin-case-detail-value" dir="ltr">{pd?.phone || '–'}</span>
          </div>
          <div className="admin-case-detail-field">
            <span className="admin-case-detail-label">כתובת מגורים</span>
            <span className="admin-case-detail-value">{pd?.address || '–'}</span>
          </div>
          <div className="admin-case-detail-field">
            <span className="admin-case-detail-label">עלות הזמנה</span>
            <span className="admin-case-detail-value admin-case-fee">${order.feeUsd || 150}</span>
          </div>
          <div className="admin-case-detail-field">
            <span className="admin-case-detail-label">הכרטיס הגיע בדואר</span>
            {yesNoBadge(order.cardReceivedByMail)}
          </div>
          {received ? (
            <>
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">הכרטיס פעיל</span>
                {yesNoBadge(order.cardActive)}
              </div>
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">מצב / תקלה בכרטיס</span>
                <span className="admin-case-detail-value">
                  {cardIssueLabels[order.cardIssue] || order.cardIssue || '–'}
                </span>
              </div>
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">צילום כרטיס הועלה</span>
                {yesNoBadge(order.hasCardPhoto)}
              </div>
            </>
          ) : (
            <div className="admin-case-detail-field admin-case-detail-field-block">
              <span className="admin-case-detail-label">הערה</span>
              <span className="admin-case-detail-value">
                הכרטיס עדיין לא הגיע – בקשה להזמנה / מעקב משלוח.
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  /** personalDetails נשמר כאובייקט (caseEmail, declarationsAccepted וכו') – לא ניתן לרנדר אובייקט ישירות ב-React */
  const renderPersonalDetailsContent = (pd) => {
    if (pd == null || pd === '') return '–';
    if (typeof pd === 'string') return pd;
    if (typeof pd !== 'object' || Array.isArray(pd)) return String(pd);

    if (pd.form === 'card_order' || pd.cardOrder) {
      return renderCardOrderDetails(pd);
    }

    if (pd.form === 'credit_agreement') {
      const ssnText =
        pd.ssnMode === 'number' && pd.ssnNumber
          ? pd.ssnNumber
          : 'הועלתה תמונה של הכרטיס';
      return (
        <div className="admin-case-detail-pd-structured">
          <div className="admin-case-detail-grid">
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">שם הלקוח בהסכם</span>
              <span className="admin-case-detail-value">{pd.fullName || '–'}</span>
            </div>
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">תאריך חתימה</span>
              <span className="admin-case-detail-value">{pd.signDate || '–'}</span>
            </div>
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">סושיאל סקיוריטי</span>
              <span className="admin-case-detail-value">{ssnText}</span>
            </div>
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">מסמך זיהוי</span>
              <span className="admin-case-detail-value">{idDocLabel(pd.idDocType) || '–'}</span>
            </div>
          </div>
        </div>
      );
    }

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

  const downloadableFiles = [];
  const rememberDownload = (storagePath, label, src) => {
    const path = String(storagePath || '').trim();
    if (!/^uploads\/[A-Za-z0-9._/-]+$/.test(path) || path.includes('..')) return;
    if (downloadableFiles.some((file) => file.path === path)) return;
    downloadableFiles.push({
      path,
      name: downloadFileName(label, path),
      src: String(src || ''),
    });
  };
  rememberDownload(c.idCardPhotoStoragePath, 'תעודת זהות', mediaFieldToUrl(c.idCardPhoto));
  rememberDownload(c.idCardAnnexStoragePath, 'נספח', mediaFieldToUrl(c.idCardAnnex));
  rememberDownload(c.signatureImageStoragePath, 'חתימה', mediaFieldToUrl(c.signatureImage));
  rememberDownload(c.agentSignatureImageStoragePath, 'חתימת סוכן', mediaFieldToUrl(c.agentSignatureImage));
  rememberDownload(c.hraDetails?.imagePath, 'תמונת HRA', c.hraDetails?.imageUrl);
  rememberDownload(c.hraDetails?.filePath, 'קובץ HRA', c.hraDetails?.fileUrl);
  attachmentRows.forEach((row, index) => rememberDownload(row.storagePath, `מסמך ${index + 1}`, row.url));
  savedAddedMembers.forEach((member, memberIndex) => {
    (member.images || []).forEach((image, imageIndex) => {
      rememberDownload(image.path, `${member.fullName || `אדם ${memberIndex + 1}`} ${imageIndex + 1}`, memberImageViewUrl(image));
    });
  });
  const enlargedDownload = downloadableFiles.find((file) => file.src && file.src === enlargedImage);
  const hasCaseImages =
    downloadableFiles.length > 0 ||
    attachmentRows.length > 0 ||
    savedAddedMembers.some((member) => (member.images || []).length > 0) ||
    Boolean(mediaFieldToUrl(c.idCardPhoto) || mediaFieldToUrl(c.idCardAnnex) || mediaFieldToUrl(c.signatureImage));

  const isCardOrderCase =
    c?.benefitType === 'card_order' ||
    c?.personalDetails?.form === 'card_order' ||
    Boolean(c?.personalDetails?.cardOrder);
  const isCreditCase =
    c?.benefitType === 'credit_agreement' || c?.personalDetails?.form === 'credit_agreement';
  const creditIdLabel = idDocLabel(c?.personalDetails?.idDocType) || 'זיהוי (דרכון/ת״ז/רישיון)';

  return (
    <div className="admin-case-detail-container">
      {enlargedImage && (
        <ImageLightbox
          src={enlargedImage}
          turn={turnOf(enlargedImage)}
          onRotate={(direction) => rotate(enlargedImage, direction)}
          onClose={() => setEnlargedImage(null)}
          onDownload={
            enlargedDownload
              ? () => downloadStoredFile(enlargedDownload.path, enlargedDownload.name)
              : undefined
          }
          downloadBusy={downloadState === enlargedDownload?.path}
        />
      )}
      <div className={`admin-case-detail-card ${getCaseStageToneClass(c)}`.trim()}>
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

        {c.hraDetails &&
        (c.hraDetails.username ||
          c.hraDetails.password ||
          c.hraDetails.imageUrl ||
          c.hraDetails.fileUrl) ? (
          <section className="admin-case-detail-section admin-case-detail-hra">
            <h2>פרטים מהאתר HRA לכייס</h2>
            <div className="admin-case-detail-grid">
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">שם משתמש</span>
                <span className="admin-case-detail-value">{c.hraDetails.username || '–'}</span>
              </div>
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">סיסמה</span>
                <span className="admin-case-detail-value">{c.hraDetails.password || '–'}</span>
              </div>
            </div>
            {c.hraDetails.imageUrl ? (
              <DocumentImage
                src={c.hraDetails.imageUrl}
                alt="תמונת HRA"
                className="admin-case-detail-uploaded-img"
                turn={turnOf(c.hraDetails.imageUrl)}
                onOpen={() => setEnlargedImage(c.hraDetails.imageUrl)}
                onRotate={(direction) => rotate(c.hraDetails.imageUrl, direction)}
                onDownload={c.hraDetails.imagePath ? () => downloadStoredFile(c.hraDetails.imagePath, downloadFileName('תמונת HRA', c.hraDetails.imagePath)) : undefined}
                downloadBusy={downloadState === c.hraDetails.imagePath}
              />
            ) : null}
            {c.hraDetails.fileUrl ? (
              <div className="admin-case-detail-attachment-card" style={{ marginTop: '0.75rem' }}>
                <a
                  className="admin-case-detail-pdf-open-link"
                  href={c.hraDetails.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {c.hraDetails.fileName || 'קובץ HRA'} – פתח / הורד
                </a>
                {renderDownloadButton(c.hraDetails.filePath, c.hraDetails.fileName || 'קובץ HRA')}
              </div>
            ) : null}
          </section>
        ) : null}

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

        {isCardOrderCase && (
          <section className="admin-case-detail-section admin-case-card-order-section">
            <h2>הזמנת כרטיס — פרטי השאלון</h2>
            {renderCardOrderDetails(c.personalDetails || {})}
          </section>
        )}

        <section className="admin-case-detail-section">
          <div className="admin-case-detail-section-head">
            <h2>תוכן הטופס</h2>
            {hasCaseImages ? (
              <button
                type="button"
                className="admin-case-detail-edit-text"
                onClick={downloadAllImages}
                disabled={Boolean(downloadState)}
              >
                {downloadState === 'all' ? 'מוריד...' : 'הורדת כל התמונות'}
              </button>
            ) : null}
            {canEditSubmittedText && !editingText && (isCardOrderCase || isCreditCase) ? (
              <button type="button" className="admin-case-detail-edit-text" onClick={() => startTextEdit()}>
                עריכת מלל
              </button>
            ) : null}
          </div>
          {downloadError ? <p className="admin-case-detail-error">{downloadError}</p> : null}
          {canEditSubmittedText && !isCardOrderCase && !isCreditCase ? (
            <div className="admin-case-add-person">
              {!editingText ? (
                <button type="button" className="admin-case-detail-edit-text" onClick={() => startTextEdit()}>
                  עריכת מלל
                </button>
              ) : null}
              <span className="admin-case-add-person-label">הוספת אדם:</span>
              {ADDED_MEMBER_ROLES.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className="admin-case-add-person-btn"
                  onClick={() => beginAddMember(role.id)}
                  disabled={textSaving}
                >
                  {role.addLabel}
                </button>
              ))}
            </div>
          ) : null}
          {editingText && textDraft ? (
            <form className="admin-case-text-edit" onSubmit={saveTextEdit}>
              <label className="admin-case-text-edit-field">
                <span>כתובת למשלוח הכרטיס בלבד</span>
                <textarea
                  value={textDraft.address}
                  onChange={(e) => handleTextDraftChange('address', e.target.value)}
                  rows={3}
                  required
                />
              </label>
              {!isCardOrderCase ? (
                <label className="admin-case-text-edit-field">
                  <span>כתובת מגורים (לא חובה)</span>
                  <textarea
                    value={textDraft.adultsOnlyAddress || ''}
                    onChange={(e) => handleTextDraftChange('adultsOnlyAddress', e.target.value)}
                    rows={3}
                  />
                </label>
              ) : null}
              {!isCardOrderCase ? (
                <div className="admin-case-text-edit-grid">
                  {[
                    ['fullName', 'שם מלא'],
                    ['dob', 'תאריך לידה'],
                    ['birthPlace', 'מקום לידה'],
                    ['fatherName', 'שם האב'],
                    ['motherName', 'שם האם'],
                    ['maritalStatus', 'מצב משפחתי'],
                    ['dependentsCount', 'מספר נתמכים'],
                    ['additionalCitizenshipCountry', 'אזרחות נוספת (קוד מדינה)'],
                  ].map(([key, label]) => (
                    <label key={key} className="admin-case-text-edit-field">
                      <span>{label}</span>
                      <input
                        type="text"
                        value={textDraft[key]}
                        onChange={(e) => handleTextDraftChange(key, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              ) : null}
              {!isCardOrderCase && Array.isArray(textDraft.addedMembers) && textDraft.addedMembers.length > 0 ? (
                <div className="admin-case-added-members">
                  {textDraft.addedMembers.map((member, idx) => (
                    <article key={member.id} className="admin-case-added-member">
                      <div className="admin-case-added-member-head">
                        <h3>
                          {ADDED_MEMBER_ROLE_LABEL[member.role] || 'אדם'} #{idx + 1}
                        </h3>
                        <button
                          type="button"
                          className="admin-case-added-member-remove"
                          onClick={() => removeDraftMember(member.id)}
                          disabled={textSaving}
                        >
                          הסרה
                        </button>
                      </div>
                      <div className="admin-case-text-edit-grid">
                        {ADDED_MEMBER_FIELDS.map(([key, label]) => (
                          <label key={key} className="admin-case-text-edit-field">
                            <span>
                              {label}
                              {key === 'fullName' ? ' *' : ''}
                            </span>
                            <input
                              type="text"
                              value={member[key] || ''}
                              onChange={(e) => updateDraftMember(member.id, key, e.target.value)}
                              required={key === 'fullName'}
                            />
                          </label>
                        ))}
                      </div>
                      <label className="admin-case-text-edit-field">
                        <span>הערות</span>
                        <textarea
                          rows={2}
                          value={member.notes || ''}
                          onChange={(e) => updateDraftMember(member.id, 'notes', e.target.value)}
                        />
                      </label>
                      <div
                        className={`admin-case-member-images${imageDropMemberId === member.id ? ' is-dragover' : ''}`}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          if (!textSaving && !member.imageUploading) setImageDropMemberId(member.id);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) setImageDropMemberId('');
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setImageDropMemberId('');
                          if (textSaving || member.imageUploading) return;
                          uploadMemberImages(member.id, e.dataTransfer.files);
                        }}
                      >
                        <span className="admin-case-text-edit-field">תמונות</span>
                        <label className="admin-case-member-image-add">
                          {member.imageUploading ? 'מעלה תמונות...' : '+ הוספת תמונה'}
                          <input
                            type="file"
                            accept="image/*,.pdf,application/pdf"
                            multiple
                            disabled={textSaving || member.imageUploading}
                            onChange={(e) => {
                              const chosen = e.target.files;
                              e.target.value = '';
                              uploadMemberImages(member.id, chosen);
                            }}
                          />
                        </label>
                        <p className="admin-case-member-drop-hint">אפשר גם לגרור תמונה לכאן</p>
                        {member.imageError ? (
                          <p className="admin-case-detail-error">{member.imageError}</p>
                        ) : null}
                        {Array.isArray(member.images) && member.images.length > 0 ? (
                          <div className="admin-case-member-image-list">
                            {member.images.map((image, imageIndex) => {
                              const src = memberImageViewUrl(image);
                              const pdf = urlLooksLikePdf(src) || urlLooksLikePdf(image.path);
                              return (
                                <div key={image.path || imageIndex} className="admin-case-member-image-item">
                                  {src && !pdf ? (
                                    <img src={src} alt={`תמונה ${imageIndex + 1}`} />
                                  ) : (
                                    <span>{pdf ? 'PDF' : 'תמונה'}</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeMemberImage(member.id, image.path)}
                                    disabled={textSaving || member.imageUploading}
                                  >
                                    הסרת תמונה
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
              <label className="admin-case-text-edit-field">
                <span>רקע משפחתי</span>
                <textarea
                  value={textDraft.familyBackground}
                  onChange={(e) => handleTextDraftChange('familyBackground', e.target.value)}
                  rows={3}
                />
              </label>
              {textError ? <p className="admin-case-detail-error">{textError}</p> : null}
              <div className="admin-case-text-edit-actions">
                <button type="submit" disabled={textSaving}>
                  {textSaving ? 'שומר...' : 'שמירת מלל'}
                </button>
                <button
                  type="button"
                  className="admin-case-text-edit-cancel"
                  onClick={() => {
                    setEditingText(false);
                    setTextDraft(null);
                    setTextError('');
                  }}
                  disabled={textSaving}
                >
                  ביטול
                </button>
              </div>
            </form>
          ) : null}
          {!editingText && !isCardOrderCase && !isCreditCase && (
          <div className="admin-case-detail-field admin-case-detail-field-block">
            <span className="admin-case-detail-label">כתובת למשלוח הכרטיס בלבד</span>
            <p className="admin-case-detail-value admin-case-detail-text">{c.address || '–'}</p>
          </div>
          )}
          {!editingText && !isCardOrderCase && !isCreditCase && String(c.personalDetails?.adultsOnlyAddress || '').trim() !== '' && (
          <div className="admin-case-detail-field admin-case-detail-field-block">
            <span className="admin-case-detail-label">כתובת מגורים</span>
            <p className="admin-case-detail-value admin-case-detail-text">{c.personalDetails.adultsOnlyAddress}</p>
          </div>
          )}
          {!editingText && typeof c.personalDetails === 'object' &&
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
          {!editingText && c.familyBackground != null && String(c.familyBackground).trim() !== '' && (
            <div className="admin-case-detail-field admin-case-detail-field-block">
              <span className="admin-case-detail-label">רקע משפחתי</span>
              <p className="admin-case-detail-value admin-case-detail-text">{c.familyBackground}</p>
            </div>
          )}
          {!editingText && !isCardOrderCase && (
          <div className="admin-case-detail-field admin-case-detail-field-block">
            <span className="admin-case-detail-label">פרטים נוספים</span>
            <div className="admin-case-detail-value admin-case-detail-text">
              {renderPersonalDetailsContent(c.personalDetails)}
            </div>
          </div>
          )}
          {!editingText && !isCardOrderCase && !isCreditCase && savedAddedMembers.length > 0 && (
            <div className="admin-case-detail-field admin-case-detail-field-block">
              <span className="admin-case-detail-label">אנשים שנוספו לתיק</span>
              <div className="admin-case-detail-children-cards">
                {savedAddedMembers.map((member) => (
                  <article key={member.id} className="admin-case-detail-child-card">
                    <h4 className="admin-case-detail-child-title">
                      {ADDED_MEMBER_ROLE_LABEL[member.role] || 'אדם'}
                      {member.fullName ? ` — ${member.fullName}` : ''}
                    </h4>
                    <div className="admin-case-detail-grid">
                      {[
                        ['dob', 'תאריך לידה'],
                        ['birthPlace', 'מקום לידה'],
                        ['fatherName', 'שם האב'],
                        ['motherName', 'שם האם'],
                        ['maritalStatus', 'מצב משפחתי'],
                        ['additionalCitizenshipCountry', 'אזרחות נוספת'],
                        ['notes', 'הערות'],
                      ]
                        .filter(([key]) => String(member[key] || '').trim() !== '')
                        .map(([key, label]) => (
                          <div key={key} className="admin-case-detail-field">
                            <span className="admin-case-detail-label">{label}</span>
                            <span className="admin-case-detail-value">{member[key]}</span>
                          </div>
                        ))}
                    </div>
                    {Array.isArray(member.images) && member.images.length > 0 ? (
                      <div className="admin-case-detail-attachments">
                        {member.images.map((image, imageIndex) => {
                          const label = `תמונה ${imageIndex + 1}`;
                          return (
                            <MemberStoredImage
                              key={image.path || imageIndex}
                              caseId={caseId}
                              storagePath={image.path}
                              src={memberImageViewUrl(image)}
                              alt={label}
                              turn={turnOf(memberImageViewUrl(image) || image.path)}
                              onOpen={(view) => setEnlargedImage(view)}
                              onRotate={(view, direction) => rotate(view, direction)}
                              onDownload={
                                image.path
                                  ? () => downloadStoredFile(image.path, downloadFileName(label, image.path))
                                  : undefined
                              }
                              downloadBusy={downloadState === image.path}
                              onRemove={
                                canEditSubmittedText && image.path
                                  ? () => removeClientImage(image.path)
                                  : undefined
                              }
                              removeBusy={removingPath === image.path}
                            />
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          )}
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
                    <div>
                      <a
                        className="admin-case-detail-pdf-open-link"
                        href={mediaFieldToUrl(c.idCardPhoto)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        פתיחת PDF – תעודת זהות / מסמך
                      </a>
                      {renderDownloadButton(c.idCardPhotoStoragePath, 'תעודת זהות')}
                      {renderRemoveButton(c.idCardPhotoStoragePath, c.idCardPhotoStoragePath ? '' : 'idCardPhoto')}
                    </div>
                  ) : (
                    <DocumentImage
                      src={mediaFieldToUrl(c.idCardPhoto)}
                      alt="תעודת זהות / מסמך"
                      className="admin-case-detail-uploaded-img"
                      turn={turnOf(mediaFieldToUrl(c.idCardPhoto))}
                      onOpen={() => setEnlargedImage(mediaFieldToUrl(c.idCardPhoto))}
                      onRotate={(direction) => rotate(mediaFieldToUrl(c.idCardPhoto), direction)}
                      onDownload={c.idCardPhotoStoragePath ? () => downloadStoredFile(c.idCardPhotoStoragePath, downloadFileName('תעודת זהות', c.idCardPhotoStoragePath)) : undefined}
                      downloadBusy={downloadState === c.idCardPhotoStoragePath}
                      onRemove={
                        canEditSubmittedText
                          ? () => removeClientImage(c.idCardPhotoStoragePath, c.idCardPhotoStoragePath ? '' : 'idCardPhoto')
                          : undefined
                      }
                      removeBusy={removingPath === (c.idCardPhotoStoragePath || 'idCardPhoto')}
                    />
                  )}
                </div>
              )}
              {mediaFieldToUrl(c.idCardAnnex) && (
                <div className="admin-case-detail-field admin-case-detail-field-block">
                  <span className="admin-case-detail-label">נספח למסמך</span>
                  {urlLooksLikePdf(mediaFieldToUrl(c.idCardAnnex)) ? (
                    <div>
                      <a
                        className="admin-case-detail-pdf-open-link"
                        href={mediaFieldToUrl(c.idCardAnnex)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        פתיחת PDF – נספח
                      </a>
                      {renderDownloadButton(c.idCardAnnexStoragePath, 'נספח')}
                      {renderRemoveButton(c.idCardAnnexStoragePath, c.idCardAnnexStoragePath ? '' : 'idCardAnnex')}
                    </div>
                  ) : (
                    <DocumentImage
                      src={mediaFieldToUrl(c.idCardAnnex)}
                      alt="נספח למסמך"
                      className="admin-case-detail-uploaded-img"
                      turn={turnOf(mediaFieldToUrl(c.idCardAnnex))}
                      onOpen={() => setEnlargedImage(mediaFieldToUrl(c.idCardAnnex))}
                      onRotate={(direction) => rotate(mediaFieldToUrl(c.idCardAnnex), direction)}
                      onDownload={c.idCardAnnexStoragePath ? () => downloadStoredFile(c.idCardAnnexStoragePath, downloadFileName('נספח', c.idCardAnnexStoragePath)) : undefined}
                      downloadBusy={downloadState === c.idCardAnnexStoragePath}
                      onRemove={
                        canEditSubmittedText
                          ? () => removeClientImage(c.idCardAnnexStoragePath, c.idCardAnnexStoragePath ? '' : 'idCardAnnex')
                          : undefined
                      }
                      removeBusy={removingPath === (c.idCardAnnexStoragePath || 'idCardAnnex')}
                    />
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
                      renderMediaCard(r, `${creditIdLabel} ${i + 1}`, i)
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

        {isCreditCase && (
          <section className="admin-case-detail-section">
            <div className="credit-skip" style={{ marginBottom: '12px' }}>
              <button type="button" className="admin-view-form-btn" onClick={() => window.print()}>
                הדפסת ההסכם החתום
              </button>
            </div>
            <CreditAgreementSheet
              readOnly
              clientName={c.personalDetails?.fullName || c.signatoryName || ''}
              signDate={c.personalDetails?.signDate || ''}
              clientSignatureUrl={mediaFieldToUrl(c.signatureImage)}
              agentSignatureUrl={mediaFieldToUrl(c.agentSignatureImage)}
            />
          </section>
        )}

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
                <DocumentImage
                  src={mediaFieldToUrl(c.signatureImage)}
                  alt="חתימה"
                  className="admin-case-detail-signature-img"
                  turn={turnOf(mediaFieldToUrl(c.signatureImage))}
                  onOpen={() => setEnlargedImage(mediaFieldToUrl(c.signatureImage))}
                  onRotate={(direction) => rotate(mediaFieldToUrl(c.signatureImage), direction)}
                  onDownload={c.signatureImageStoragePath ? () => downloadStoredFile(c.signatureImageStoragePath, downloadFileName('חתימה', c.signatureImageStoragePath)) : undefined}
                  downloadBusy={downloadState === c.signatureImageStoragePath}
                />
              </div>
            )}
          </section>
        )}

        <div className="admin-case-detail-actions">
          <button
            type="button"
            className="admin-case-status-btn"
            onClick={() => setStatusModalOpen(true)}
          >
            סטטוס הכייס
          </button>
          <ShareCaseButton
            title={`כייס של ${c.userName || c.personalDetails?.fullName || 'לקוח'}`}
            lines={[
              `סוג: ${benefitTitles[c.benefitType] || c.benefitType}`,
              `סטטוס: ${shortStageLabel(c.detailedAdminStatus) || c.status || ''}`,
              c.renewalDate ? `חידוש: ${formatDate(c.renewalDate)}` : '',
            ]}
            url={`${window.location.origin}/admin/cases/${c.id}`}
          />
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
            חזרה לניהול תיקי לקוחות
          </button>
        </div>
      </div>

      {statusModalOpen ? (
        <CaseStatusModal
          caseItem={c}
          onClose={() => setStatusModalOpen(false)}
          onUpdated={(updated) => {
            if (updated) setCaseData((prev) => ({ ...prev, ...updated }));
          }}
        />
      ) : null}
    </div>
  );
};

export default AdminCaseDetail;
