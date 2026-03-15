import React, { useState } from 'react';
import './TestimonialTicker.css';

const REVIEWS = [
  {
    name: "מנחם מענדל",
    message: "יואוו תודה רבה על הטיפול המהיר בכייס שלי! לא ציפיתי שזה ייסגר כל כך מהר. אלופים! 🙏🔥",
    time: "10:42"
  },
  {
    name: "חיה מושקא",
    message: "שירות מדהים! פשוט נכנסתי לאתר והכל היה ברור. תודה על פתיחת התיק והסבלנות.",
    time: "11:15"
  },
  {
    name: "יוסף יצחק",
    message: "רציתי להגיד תודה ענקית. עשיתם לי סדר בבלאגן, הטיפול בכייס היה סופר מקצועי. 💪",
    time: "13:05"
  },
  {
    name: "רבקה",
    message: "היי, רק רציתי לעדכן שהכל הסתדר! תודה על העזרה המהירה והאדיבה עם הכייס. ממליצה בחום! 🤩",
    time: "14:30"
  },
  {
    name: "יוסי כהן",
    message: "אין עליכם! פתחתם לי את התיק בשנייה וחסכתם לי המון כאב ראש. שירות פגז.",
    time: "16:22"
  },
  {
    name: "לוי יצחק",
    message: "תודה רבה על הכל! מקצועיות ברמה הכי גבוהה שיש, שמח שבחרתי בכם לטפל בכייס שלי.",
    time: "18:45"
  }
];

export default function TestimonialTicker() {
  const [isVisible, setIsVisible] = useState(true);
  const [selectedReview, setSelectedReview] = useState(null);

  if (!isVisible) return null;

  return (
    <>
      <div className="testimonial-ticker-widget" dir="rtl">
        <div className="ticker-header">
          <h4 className="ticker-title">
            <span role="img" aria-label="star">⭐</span> לקוחות ממליצים
          </h4>
          <button 
            className="ticker-close-btn" 
            onClick={() => setIsVisible(false)}
            aria-label="סגור"
          >
            &times;
          </button>
        </div>
        
        <div className="ticker-scroll-area">
          <div className="ticker-content">
            {/* Render the list twice for an infinite loop effect */}
            {[...REVIEWS, ...REVIEWS].map((review, index) => (
              <div 
                key={index} 
                className="ticker-item wa-preview-bubble"
                onClick={() => setSelectedReview(review)}
              >
                <div className="wa-bubble-header">
                  <span className="wa-name">{review.name}</span>
                </div>
                <p className="wa-preview-text">{review.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Overlay for Expanded Review */}
      {selectedReview && (
        <div className="wa-modal-overlay" onClick={() => setSelectedReview(null)} dir="rtl">
          <div className="wa-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="wa-modal-close" onClick={() => setSelectedReview(null)}>&times;</button>
            <div className="wa-modal-bubble">
              <div className="wa-bubble-header">
                <span className="wa-name">{selectedReview.name}</span>
              </div>
              <p className="wa-text">{selectedReview.message}</p>
              <div className="wa-footer">
                <span className="wa-time">{selectedReview.time}</span>
                <span className="wa-ticks">✓✓</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
