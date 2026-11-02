import SignaturePad from './SignaturePad';
import { AGENT_SIGNATURE_SRC, CREDIT_AGREEMENT, formatSignDate } from '../data/creditAgreement';
import './CreditAgreementSheet.css';

export default function CreditAgreementSheet({
  clientName,
  signDate,
  onClientNameChange,
  onSignDateChange,
  clientSignatureUrl,
  agentSignatureUrl,
  onClientSignatureChange,
  readOnly = false,
  clearSignatureLabel = 'ניקוי חתימה',
}) {
  const agentSrc = agentSignatureUrl || AGENT_SIGNATURE_SRC;

  return (
    <article className="credit-sheet" dir="rtl">
      <p className="credit-kicker">{CREDIT_AGREEMENT.kicker}</p>
      <h1>{CREDIT_AGREEMENT.title}</h1>
      <p className="credit-sub">{CREDIT_AGREEMENT.sub}</p>
      <p className="credit-lead">{CREDIT_AGREEMENT.lead}</p>

      <label htmlFor="credit-client-name">שם הלקוח</label>
      {readOnly ? (
        <p className="credit-filled">{clientName || '—'}</p>
      ) : (
        <input
          id="credit-client-name"
          type="text"
          value={clientName}
          placeholder="השם המלא של הלקוח"
          autoComplete="name"
          onChange={(e) => onClientNameChange?.(e.target.value)}
        />
      )}

      <label htmlFor="credit-sign-date">תאריך חתימה</label>
      {readOnly ? (
        <p className="credit-filled">{formatSignDate(signDate) || '—'}</p>
      ) : (
        <input
          id="credit-sign-date"
          type="date"
          value={signDate}
          onChange={(e) => onSignDateChange?.(e.target.value)}
        />
      )}

      <ol className="credit-terms">
        {CREDIT_AGREEMENT.sections.map((section) => (
          <li key={section.title}>
            <b>{section.title}</b>
            <ol className="credit-inner">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </li>
        ))}
        <li>
          <b>{CREDIT_AGREEMENT.signatureTitle}</b> {CREDIT_AGREEMENT.signatureClause}
        </li>
      </ol>

      <div className="credit-signs">
        <div className="credit-signer">
          <div className="credit-who">הלקוח</div>
          <div className="credit-hint">חתימה באצבע או בעכבר</div>
          {readOnly ? (
            clientSignatureUrl ? (
              <img className="credit-sign-img" src={clientSignatureUrl} alt="חתימת הלקוח" />
            ) : (
              <p className="credit-filled">—</p>
            )
          ) : (
            <SignaturePad
              ariaLabel="חתימת הלקוח"
              clearLabel={clearSignatureLabel}
              onChange={onClientSignatureChange}
            />
          )}
        </div>
        <div className="credit-signer">
          <div className="credit-who">יוד גרונברג</div>
          <div className="credit-hint">חתימת יוד גרונברג על הסכם זה</div>
          <img className="credit-sign-img" src={agentSrc} alt="חתימת יוד גרונברג" />
        </div>
      </div>
    </article>
  );
}
