import { Component } from 'react';

/**
 * גבול שגיאות גלובלי. בלי זה, כל שגיאת רינדור מפילה את כל האפליקציה למסך לבן
 * (תופעה שדווחה במיוחד בטלפוני אפל). כאן אנו תופסים את השגיאה ומציגים הודעה
 * ידידותית עם כפתור רענון, במקום מסך ריק.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] נתפסה שגיאה לא צפויה:', error, info?.componentStack);
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch (_) {
      window.location.href = '/';
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        dir="rtl"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Arial, sans-serif',
          background: '#f7f9fc',
          color: '#1a1a1a',
        }}
      >
        <div
          style={{
            maxWidth: '460px',
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
            padding: '32px 28px',
          }}
        >
          <div style={{ fontSize: '44px', marginBottom: '12px' }}>⚠️</div>
          <h1 style={{ fontSize: '22px', margin: '0 0 10px' }}>אירעה תקלה זמנית</h1>
          <p style={{ fontSize: '16px', lineHeight: 1.6, margin: '0 0 6px', color: '#444' }}>
            משהו השתבש בטעינת הדף. הנתונים שלכם לא אבדו – נסו לרענן ולנסות שוב.
          </p>
          <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '0 0 20px', color: '#888' }}>
            Something went wrong. Please refresh and try again.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 28px',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            רענון הדף / Refresh
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
