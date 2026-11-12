import { useState } from 'react';
import './RotatableImage.css';

export function useImageRotation() {
  const [turns, setTurns] = useState({});
  const turnOf = (src) => (src ? turns[src] || 0 : 0);
  const rotate = (src, direction) => {
    if (!src) return;
    const step = direction < 0 ? -1 : 1;
    setTurns((prev) => ({ ...prev, [src]: ((prev[src] || 0) + step + 4) % 4 }));
  };
  return { turnOf, rotate };
}

export function RotateControls({ onLeft, onRight }) {
  return (
    <div className="image-rotate-controls" onClick={(event) => event.stopPropagation()}>
      <button type="button" onClick={onLeft} aria-label="סובב שמאלה">
        סובב שמאלה
      </button>
      <button type="button" onClick={onRight} aria-label="סובב ימינה">
        סובב ימינה
      </button>
    </div>
  );
}

export function DocumentImage({ src, alt, className, turn = 0, onOpen, onRotate }) {
  const sideways = turn % 2 === 1;
  return (
    <div className="document-image">
      <button type="button" className="document-image-open" onClick={onOpen}>
        <span className={`document-image-frame ${sideways ? 'is-sideways' : ''}`}>
          <img
            src={src}
            alt={alt}
            className={className}
            style={{ transform: `rotate(${turn * 90}deg)` }}
          />
        </span>
      </button>
      <RotateControls onLeft={() => onRotate(-1)} onRight={() => onRotate(1)} />
    </div>
  );
}

export function ImageLightbox({ src, alt = 'תצוגה מוגדלת', turn = 0, onRotate, onClose }) {
  if (!src) return null;
  const sideways = turn % 2 === 1;
  return (
    <div className="image-lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={alt}>
      <button type="button" className="image-lightbox-close" onClick={onClose} aria-label="סגור">
        ×
      </button>
      <img
        src={src}
        alt={alt}
        className={`image-lightbox-img ${sideways ? 'is-sideways' : ''}`}
        style={{ transform: `rotate(${turn * 90}deg)` }}
        onClick={(event) => event.stopPropagation()}
      />
      <div className="image-lightbox-tools" onClick={(event) => event.stopPropagation()}>
        <RotateControls onLeft={() => onRotate(-1)} onRight={() => onRotate(1)} />
      </div>
    </div>
  );
}
