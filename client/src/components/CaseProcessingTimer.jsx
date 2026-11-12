import { useEffect, useState } from 'react';
import { caseProcessingTimer, formatProcessingElapsed } from '../utils/caseProcessingStages';
import './CaseProcessingTimer.css';

export default function CaseProcessingTimer({ caseItem, compact = false }) {
  const [now, setNow] = useState(() => Date.now());
  const timer = caseProcessingTimer(caseItem, now);

  useEffect(() => {
    if (!timer || timer.stopped) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, [timer?.stopped, caseItem?.id, caseItem?.processingTimerStartedAt, caseItem?.processingTimerStoppedAt, caseItem?.detailedAdminStatus]);

  if (!timer) return null;

  const label = timer.hasDuration ? formatProcessingElapsed(timer.elapsed) : 'בהגשת הטפסים';

  return (
    <div className={`case-timer case-timer--${timer.tone} ${compact ? 'case-timer--compact' : ''}`} role="status">
      <span className="case-timer-kicker">{timer.stopped ? 'הטיימר נעצר' : 'מאז נפתחה בקשה'}</span>
      <strong className="case-timer-value">{label}</strong>
    </div>
  );
}
