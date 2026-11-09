import { useState } from 'react';
import axios from 'axios';
import { compressImageFile } from '../utils/imageCompression';

function isImageFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|heic|heif|bmp)$/i.test(file.name || '');
}

/**
 * מועד מדויק לחידוש ותמונת הסכום שאושר — במקום פירוט ההטבות הישן.
 */
export default function CaseApprovalFields({
  idPrefix,
  renewalDate,
  onRenewalDateChange,
  amountPreview,
  onAmountImagePath,
  disabled,
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    if (!isImageFile(file)) {
      setUploadError('אפשר להעלות רק תמונה.');
      return;
    }
    setUploadError('');
    setUploading(true);
    try {
      const data = await compressImageFile(file);
      const res = await axios.post('/cases/upload-attachment', {
        data,
        category: 'approved-amount',
        fileName: file.name || 'approved-amount',
      });
      const path = res.data?.path || '';
      if (!path) throw new Error('missing path');
      onAmountImagePath(path, data);
    } catch {
      setUploadError('העלאת התמונה נכשלה. נסו שוב.');
      onAmountImagePath('', '');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-processing-benefits-form">
      <label htmlFor={`${idPrefix}-renewal`}>מועד מדויק לחידוש הכייס</label>
      <input
        id={`${idPrefix}-renewal`}
        type="date"
        className="admin-processing-modal-input case-approval-date"
        value={renewalDate}
        onChange={(e) => onRenewalDateChange(e.target.value)}
        disabled={disabled || uploading}
        required
      />
      <label htmlFor={`${idPrefix}-amount`}>תמונה של כמה כסף אושר לכייס</label>
      <input
        id={`${idPrefix}-amount`}
        type="file"
        accept="image/*"
        className="case-approval-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          handleFile(file);
        }}
        disabled={disabled || uploading}
      />
      {uploading ? <p className="case-approval-note">מעלה את התמונה...</p> : null}
      {uploadError ? <p className="case-approval-note case-approval-note-error">{uploadError}</p> : null}
      {amountPreview ? (
        <img src={amountPreview} alt="הסכום שאושר לכייס" className="case-approval-preview" />
      ) : null}
    </div>
  );
}
