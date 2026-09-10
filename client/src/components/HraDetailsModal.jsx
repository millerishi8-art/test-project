import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { compressImageFile, readFileAsDataUrl } from '../utils/imageCompression';
import './HraDetailsModal.css';

function isImageFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|heic|heif|bmp)$/i.test(file.name || '');
}

function filesFromTransfer(transfer) {
  if (!transfer) return [];
  const fromFiles = Array.from(transfer.files || []);
  if (fromFiles.length) return fromFiles;
  return Array.from(transfer.items || [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter(Boolean);
}

function firstImageFromTransfer(transfer) {
  return filesFromTransfer(transfer).find(isImageFile) || null;
}

function transferLooksLikeFiles(dt) {
  if (!dt) return false;
  const types = dt.types;
  if (!types) return false;
  if (typeof types.contains === 'function') return types.contains('Files');
  if (typeof types.includes === 'function') return types.includes('Files');
  return Array.from(types).includes('Files');
}

function hasHraContent(hra) {
  if (!hra || typeof hra !== 'object') return false;
  return Boolean(
    String(hra.username || '').trim() ||
      String(hra.password || '').trim() ||
      hra.imagePath ||
      hra.filePath ||
      hra.imageUrl ||
      hra.fileUrl
  );
}

async function uploadFile(file, category) {
  const isImage = file?.type?.startsWith('image/');
  const data = isImage ? await compressImageFile(file) : await readFileAsDataUrl(file);
  const res = await axios.post('/cases/upload-attachment', {
    data,
    category,
    fileName: file.name || 'upload',
  });
  return res.data?.path || null;
}

export { hasHraContent };

/**
 * מודל פרטי HRA לתיק – תמונה, קובץ, שם משתמש וסיסמה לשיתוף עם העובדים.
 */
export default function HraDetailsModal({ caseId, caseLabel, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [imagePath, setImagePath] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [filePath, setFilePath] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState('');
  const [localImagePreview, setLocalImagePreview] = useState(null);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [clearImage, setClearImage] = useState(false);
  const [clearFile, setClearFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get(`/admin/cases/${caseId}`);
        if (cancelled) return;
        const h = res.data?.hraDetails || {};
        setUsername(h.username || '');
        setPassword(h.password || '');
        setImagePath(h.imagePath || null);
        setImageUrl(h.imageUrl || null);
        setFilePath(h.filePath || null);
        setFileUrl(h.fileUrl || null);
        setFileName(h.fileName || '');
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'שגיאה בטעינת פרטי HRA');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  useEffect(() => {
    const onPaste = (e) => {
      const image = firstImageFromTransfer(e.clipboardData);
      if (!image) return;
      e.preventDefault();
      applyImageFile(image);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  useEffect(() => {
    return () => {
      if (localImagePreview) URL.revokeObjectURL(localImagePreview);
    };
  }, [localImagePreview]);

  const displayImage = localImagePreview || (!clearImage ? imageUrl : null);
  const displayFileName = pendingFile?.name || (!clearFile ? fileName : '') || '';
  const displayFileUrl = !clearFile && !pendingFile ? fileUrl : null;

  const applyImageFile = (file) => {
    if (!file) return false;
    if (!isImageFile(file)) {
      setError('יש לבחור קובץ תמונה בלבד');
      return false;
    }
    setError('');
    setPendingImageFile(file);
    setClearImage(false);
    const preview = URL.createObjectURL(file);
    setLocalImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return preview;
    });
    return true;
  };

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) applyImageFile(file);
  };

  const endDrag = () => {
    dragDepthRef.current = 0;
    setIsDragging(false);
  };

  const onDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!transferLooksLikeFiles(e.dataTransfer)) return;
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };

  const onDropMedia = (e) => {
    e.preventDefault();
    e.stopPropagation();
    endDrag();
    const image = firstImageFromTransfer(e.dataTransfer);
    if (image) {
      applyImageFile(image);
      return;
    }
    const other = filesFromTransfer(e.dataTransfer)[0];
    if (other) {
      setError('');
      setPendingFile(other);
      setClearFile(false);
      setFileName(other.name || 'קובץ');
      return;
    }
    setError('לא נמצאה תמונה לגרירה. נסה לגרור קובץ תמונה או להדביק עם Ctrl+V.');
  };

  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setPendingFile(file);
    setClearFile(false);
    setFileName(file.name || 'קובץ');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      let nextImagePath = imagePath;
      let nextFilePath = filePath;
      let nextFileName = fileName;

      if (pendingImageFile) {
        nextImagePath = await uploadFile(pendingImageFile, 'hra_image');
        if (!nextImagePath) throw new Error('העלאת התמונה נכשלה');
      }
      if (pendingFile) {
        nextFilePath = await uploadFile(pendingFile, 'hra_file');
        if (!nextFilePath) throw new Error('העלאת הקובץ נכשלה');
        nextFileName = pendingFile.name || nextFileName;
      }

      const res = await axios.patch(`/admin/cases/${caseId}/hra`, {
        username,
        password,
        imagePath: clearImage ? undefined : nextImagePath,
        filePath: clearFile ? undefined : nextFilePath,
        fileName: clearFile ? undefined : nextFileName,
        clearImage: clearImage || false,
        clearFile: clearFile || false,
      });

      onSaved?.(res.data?.case);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const isPdf =
    /\.pdf$/i.test(displayFileName || '') ||
    (displayFileUrl && /\.pdf(\?|$)/i.test(displayFileUrl));

  return (
    <div
      className={`hra-modal-overlay${isDragging ? ' is-dragging' : ''}`}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDropMedia}
    >
      <div
        className="hra-modal"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDrop={onDropMedia}
      >
        <header className="hra-modal-header">
          <div>
            <h2>פרטים מהאתר HRA לכייס</h2>
            {caseLabel ? <p className="hra-modal-sub">{caseLabel}</p> : null}
          </div>
          <button type="button" className="hra-modal-close" onClick={onClose} aria-label="סגור">
            ×
          </button>
        </header>

        {loading ? (
          <p className="hra-modal-status">טוען...</p>
        ) : (
          <div className="hra-modal-body">
            {error ? <p className="hra-modal-error">{error}</p> : null}

            <section className="hra-section">
              <h3>פרטי התחברות לבעל הכייס</h3>
              <p className="hra-hint">שם משתמש וסיסמה לאתר HRA – לשיתוף עם שאר העובדים.</p>
              <label className="hra-field">
                <span>שם משתמש</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  placeholder="שם משתמש"
                />
              </label>
              <label className="hra-field">
                <span>סיסמה</span>
                <div className="hra-password-row">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    placeholder="סיסמה"
                  />
                  <button type="button" className="hra-text-btn" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? 'הסתר' : 'הצג'}
                  </button>
                </div>
              </label>
            </section>

            <section className="hra-section">
              <h3>תמונה</h3>
              <p className="hra-hint">גרור תמונה לכאן כמו בוואטסאפ, או הדבק עם Ctrl+V.</p>
              <div className="hra-upload-row">
                <label className="hra-file-label">
                  בחירת תמונה
                  <input type="file" accept="image/*" onChange={onPickImage} hidden />
                </label>
                {displayImage ? (
                  <button
                    type="button"
                    className="hra-text-btn danger"
                    onClick={() => {
                      setPendingImageFile(null);
                      setLocalImagePreview((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return null;
                      });
                      setClearImage(true);
                    }}
                  >
                    הסר תמונה
                  </button>
                ) : null}
              </div>
              <div
                className={`hra-dropzone${isDragging ? ' is-active' : ''}${displayImage ? ' has-preview' : ''}`}
                onDragOver={onDragOver}
                onDrop={onDropMedia}
              >
                {displayImage ? (
                  <div className="hra-image-preview">
                    <img src={displayImage} alt="תמונת HRA" />
                  </div>
                ) : (
                  <p className="hra-dropzone-empty">גרור תמונה לכאן או לחץ על בחירת תמונה</p>
                )}
              </div>
            </section>

            <section className="hra-section">
              <h3>קובץ מצורף</h3>
              <div className="hra-upload-row">
                <label className="hra-file-label">
                  בחירת קובץ
                  <input type="file" onChange={onPickFile} hidden />
                </label>
                {(displayFileName || displayFileUrl) ? (
                  <button
                    type="button"
                    className="hra-text-btn danger"
                    onClick={() => {
                      setPendingFile(null);
                      setClearFile(true);
                      setFileName('');
                    }}
                  >
                    הסר קובץ
                  </button>
                ) : null}
              </div>
              {pendingFile ? (
                <div className="hra-file-card">
                  <strong>{pendingFile.name}</strong>
                  <span>מוכן להעלאה ({Math.max(1, Math.round(pendingFile.size / 1024))} KB)</span>
                </div>
              ) : displayFileUrl ? (
                <div className="hra-file-card">
                  <strong>{displayFileName || 'קובץ מצורף'}</strong>
                  <a href={displayFileUrl} target="_blank" rel="noopener noreferrer">
                    פתח / הורד
                  </a>
                  {isPdf ? (
                    <iframe title="HRA file preview" src={displayFileUrl} className="hra-file-frame" />
                  ) : null}
                </div>
              ) : (
                <p className="hra-empty">לא הועלה קובץ</p>
              )}
            </section>
          </div>
        )}

        {isDragging ? (
          <div className="hra-drag-overlay" aria-hidden="true">
            <div className="hra-drag-overlay-card">
              <strong>שחרר כאן את התמונה</strong>
              <span>התמונה תתווסף לטופס פרטי ה-HRA</span>
            </div>
          </div>
        ) : null}

        <footer className="hra-modal-footer">
          <button type="button" className="hra-btn secondary" onClick={onClose} disabled={saving}>
            סגור
          </button>
          <button type="button" className="hra-btn primary" onClick={handleSave} disabled={loading || saving}>
            {saving ? 'שומר...' : 'שמור פרטים'}
          </button>
        </footer>
      </div>
    </div>
  );
}
