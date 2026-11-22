import { useEffect, useId, useRef, useState } from 'react';
import './ShareCaseButton.css';

function shareText(title, lines, url) {
  return [title, ...lines.filter(Boolean), url].filter(Boolean).join('\n');
}

const LABELS = {
  he: {
    share: 'שיתוף',
    whatsapp: 'וואטסאפ',
    telegram: 'טלגרם',
    more: 'שאר האפליקציות',
    copy: 'העתקת ההודעה',
    copied: 'ההודעה הועתקה',
  },
  en: {
    share: 'Share',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    more: 'Other apps',
    copy: 'Copy message',
    copied: 'Message copied',
  },
};

export default function ShareCaseButton({ title, lines = [], url, language = 'he', className = '' }) {
  const labels = LABELS[language] || LABELS.he;
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const wrapRef = useRef(null);
  const menuId = useId();
  const text = shareText(title, lines, url);
  const canUseSystemShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const shareWithSystem = async () => {
    if (!canUseSystemShare) return;
    try {
      await navigator.share({ title, text, url });
      setOpen(false);
    } catch (err) {
      if (err?.name === 'AbortError') setOpen(false);
    }
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(labels.copied);
      setTimeout(() => setNotice(''), 2000);
      setOpen(false);
    } catch {
      setNotice('');
    }
  };

  return (
    <div className={`share-case ${className}`.trim()} ref={wrapRef}>
      <button
        type="button"
        className="share-case-btn"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {labels.share}
      </button>
      {notice ? <span className="share-case-notice">{notice}</span> : null}
      {open ? (
        <div className="share-case-menu" id={menuId} role="menu">
          <a role="menuitem" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            {labels.whatsapp}
          </a>
          <a
            role="menuitem"
            href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent([title, ...lines.filter(Boolean)].join('\n'))}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {labels.telegram}
          </a>
          {canUseSystemShare ? (
            <button type="button" role="menuitem" onClick={shareWithSystem}>
              {labels.more}
            </button>
          ) : null}
          <button type="button" role="menuitem" onClick={copyMessage}>
            {labels.copy}
          </button>
        </div>
      ) : null}
    </div>
  );
}
