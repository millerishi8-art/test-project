import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import CreditAgreementSheet from '../components/CreditAgreementSheet';
import { idDocLabel } from '../data/creditAgreement';
import './CreditAgreement.css';

const CreditAgreementPrint = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await axios.get(`/cases/${caseId}`);
        const row = res.data?.case;
        if (!row || String(row.benefitType) !== 'credit_agreement') {
          if (!cancelled) setError('ההסכם לא נמצא');
          return;
        }
        if (!cancelled) setCaseData(row);
      } catch {
        if (!cancelled) setError('ההסכם לא נמצא');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  if (loading) {
    return <div className="credit-page">טוען את ההסכם...</div>;
  }

  if (error || !caseData) {
    return (
      <div className="credit-page" dir="rtl">
        <p className="credit-form-error">{error || 'ההסכם לא נמצא'}</p>
        <button type="button" className="credit-back-btn" onClick={() => navigate('/case-status')}>
          חזרה
        </button>
      </div>
    );
  }

  const pd = caseData.personalDetails || {};
  const ssnLine =
    pd.ssnMode === 'number' && pd.ssnNumber
      ? `מספר סושיאל סקיוריטי: ${pd.ssnNumber}`
      : 'סושיאל סקיוריטי: הועלתה תמונה';

  return (
    <div className="credit-page" dir="rtl">
      <div className="credit-bar credit-skip">
        <button type="button" className="credit-print-btn" onClick={() => window.print()}>
          הדפסה
        </button>
        <button type="button" className="credit-back-btn" onClick={() => navigate('/case-status')}>
          חזרה לסטטוס
        </button>
      </div>
      <CreditAgreementSheet
        readOnly
        clientName={pd.fullName || caseData.signatoryName || ''}
        signDate={pd.signDate || ''}
        clientSignatureUrl={typeof caseData.signatureImage === 'string' ? caseData.signatureImage : ''}
        agentSignatureUrl={typeof caseData.agentSignatureImage === 'string' ? caseData.agentSignatureImage : ''}
      />
      <section className="credit-extra credit-skip">
        <p>{ssnLine}</p>
        <p>מסמך זיהוי: {idDocLabel(pd.idDocType) || '—'}</p>
      </section>
    </div>
  );
};

export default CreditAgreementPrint;
