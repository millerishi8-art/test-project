import { useEffect, useRef } from 'react';

/**
 * משטח חתימה. onChange מקבל data URL כשיש דיו, ומחרוזת ריקה אחרי ניקוי.
 */
export default function SignaturePad({ ariaLabel, clearLabel, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ratio = window.devicePixelRatio || 1;

    const paint = (snapshot) => {
      const box = canvas.getBoundingClientRect();
      const width = Math.max(box.width, 260);
      canvas.width = width * ratio;
      canvas.height = 140 * ratio;
      const pen = canvas.getContext('2d');
      pen.setTransform(ratio, 0, 0, ratio, 0, 0);
      pen.lineWidth = 2.4;
      pen.lineCap = 'round';
      pen.lineJoin = 'round';
      pen.strokeStyle = '#16324f';
      if (snapshot) {
        const img = new Image();
        img.onload = () => pen.drawImage(img, 0, 0, width, 140);
        img.src = snapshot;
      }
    };

    paint(dirty.current ? canvas.toDataURL('image/png') : null);
    const onResize = () => {
      const snapshot = dirty.current ? canvas.toDataURL('image/png') : null;
      paint(snapshot);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const emit = () => {
    const canvas = canvasRef.current;
    if (!canvas || !dirty.current) {
      onChangeRef.current?.('');
      return;
    }
    onChangeRef.current?.(canvas.toDataURL('image/png'));
  };

  const pointFrom = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerDown = (event) => {
    const canvas = canvasRef.current;
    const pen = canvas.getContext('2d');
    event.preventDefault();
    drawing.current = true;
    dirty.current = true;
    canvas.setPointerCapture(event.pointerId);
    const p = pointFrom(event);
    pen.beginPath();
    pen.moveTo(p.x, p.y);
    pen.lineTo(p.x + 0.1, p.y + 0.1);
    pen.stroke();
  };

  const handlePointerMove = (event) => {
    if (!drawing.current) return;
    event.preventDefault();
    const pen = canvasRef.current.getContext('2d');
    const p = pointFrom(event);
    pen.lineTo(p.x, p.y);
    pen.stroke();
  };

  const stop = () => {
    if (!drawing.current) return;
    drawing.current = false;
    emit();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const pen = canvas.getContext('2d');
    pen.save();
    pen.setTransform(1, 0, 0, 1, 0, 0);
    pen.clearRect(0, 0, canvas.width, canvas.height);
    pen.restore();
    dirty.current = false;
    onChangeRef.current?.('');
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="credit-ink"
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
      />
      <button type="button" className="credit-wipe credit-skip" onClick={clear}>
        {clearLabel}
      </button>
    </div>
  );
}
