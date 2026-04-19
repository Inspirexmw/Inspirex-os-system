import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/sections/Dashboard';
import { ProjectCalculator } from '@/sections/ProjectCalculator';
import { WorkLog } from '@/sections/WorkLog';
import { CommitmentTracker } from '@/sections/CommitmentTracker';
import { MonthlySummary } from '@/sections/MonthlySummary';
import { TeamManagement } from '@/sections/TeamManagement';
import { Settings } from '@/sections/Settings';
import { Billing } from '@/sections/Billing';
import { WorkingCapital } from '@/sections/WorkingCapital';
import { AppProvider, useApp } from '@/hooks/useAppState';
import { Toaster } from '@/components/ui/sonner';
import type { ViewType } from '@/types';
import type { BillingDocument } from '@/types';

// ── Quote Approval Page ────────────────────────────────────────────────────────
function ApprovalPage({ token }: { token: string }) {
  const { state, dispatch } = useApp();
  const [status, setStatus] = useState<'pending' | 'approved' | 'declined'>('pending');

  const doc = state.billing.documents.find(
    (d: BillingDocument) => d.approvalToken === token
  );
  const client = doc ? state.billing.clients.find(c => c.id === doc.clientId) : null;
  const settings = state.billing.settings;

  useEffect(() => {
    if (doc && (doc.approvalOpenedCount === 0 || doc.approvalOpenedCount === undefined)) {
      dispatch({ type: 'BILLING_UPDATE_DOCUMENT', payload: { ...doc, approvalOpenedCount: (doc.approvalOpenedCount || 0) + 1, updatedAt: new Date().toISOString() } });
    }
  }, []);

  const respond = (action: 'approved' | 'declined') => {
    if (!doc) return;
    dispatch({ type: 'BILLING_UPDATE_DOCUMENT', payload: { ...doc, status: action === 'approved' ? 'accepted' : 'rejected', updatedAt: new Date().toISOString() } });
    setStatus(action);
    // Open mailto to notify InspireX
    const subject = encodeURIComponent((action === 'approved' ? 'Quote Approved — ' : 'Quote Declined — ') + doc.number);
    const body = encodeURIComponent(
      'Hi ' + settings.companyName + ',\n\n' +
      (action === 'approved'
        ? 'I am pleased to confirm that I approve Quote ' + doc.number + ' for the amount of ' + doc.total.toLocaleString() + ' ' + doc.currency + '.\n\nPlease proceed with the project.'
        : 'After consideration, I have decided to decline Quote ' + doc.number + '.\n\nThank you for the proposal.') +
      '\n\nRegards,\n' + (client?.name || 'Client')
    );
    window.open('mailto:' + settings.email + '?subject=' + subject + '&body=' + body);
  };

  // Set page title to company name dynamically
  useEffect(() => {
    document.title = settings.companyName || 'InspireX Studio Lab';
    return () => { document.title = 'InspireX Studio Lab'; };
  }, [settings.companyName]);

  if (!doc) return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✕</div>
        <div style={{ fontSize: '16px', color: '#fff', marginBottom: '8px' }}>Quote not found</div>
        <div style={{ fontSize: '12px' }}>This link may have expired or been removed.</div>
      </div>
    </div>
  );

  const sym = doc.currency === 'MWK' ? 'MK' : doc.currency === 'USD' ? '$' : 'R';

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            {settings.logoBase64
              ? <img src={settings.logoBase64} alt="logo" style={{ height: '28px', objectFit: 'contain', marginBottom: '4px' }} />
              : <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>Inspire<span style={{ color: '#73F764' }}>X</span></div>}
            <div style={{ fontSize: '9px', color: '#555' }}>{settings.tagline}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#73F764', letterSpacing: '1px' }}>QUOTE</div>
            <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}># {doc.number}</div>
          </div>
        </div>
        <div style={{ height: '0.5px', background: '#73F764', margin: '12px 0 16px' }} />

        {/* Amount highlight */}
        <div style={{ background: '#111', borderRadius: '8px', padding: '20px 24px', marginBottom: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Total Amount</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#73F764' }}>{sym} {doc.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          {(doc as any).projectName && <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>{(doc as any).projectName}</div>}
          <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>Valid until {doc.validUntil || '—'}</div>
        </div>

        {/* Line items */}
        <div style={{ background: '#0A0A0A', border: '0.5px solid #1a1a1a', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
          {doc.lineItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < doc.lineItems.length - 1 ? '0.5px solid #1a1a1a' : 'none' }}>
              <div style={{ color: '#ddd', fontSize: '11px' }}>{item.description.split('\n')[0]}</div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap', marginLeft: '12px' }}>{sym} {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          ))}
        </div>

        {/* Notes */}
        {doc.notes && <div style={{ fontSize: '10px', color: '#666', marginBottom: '16px', lineHeight: 1.6 }}>{doc.notes}</div>}

        {/* Approval actions */}
        {status === 'pending' && doc.status !== 'accepted' && doc.status !== 'rejected' && (
          <div>
            <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', marginBottom: '12px' }}>Review the quote above and respond below</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button onClick={() => respond('approved')} style={{ padding: '12px', background: '#73F764', color: '#000', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>✓ Approve Quote</button>
              <button onClick={() => respond('declined')} style={{ padding: '12px', background: '#1a1a1a', color: '#888', borderRadius: '6px', border: '0.5px solid #333', fontSize: '13px', cursor: 'pointer' }}>✗ Decline</button>
            </div>
            <div style={{ fontSize: '9px', color: '#444', textAlign: 'center', marginTop: '10px' }}>Clicking Approve will notify {settings.companyName} via email</div>
          </div>
        )}

        {/* Responded states */}
        {(status === 'approved' || doc.status === 'accepted') && (
          <div style={{ textAlign: 'center', padding: '20px', background: '#0a1f0a', border: '0.5px solid #73F764', borderRadius: '8px' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>✓</div>
            <div style={{ color: '#73F764', fontWeight: 700, fontSize: '14px' }}>Quote Approved</div>
            <div style={{ color: '#3a7a3a', fontSize: '11px', marginTop: '4px' }}>Thank you. {settings.companyName} has been notified.</div>
          </div>
        )}
        {(status === 'declined' || doc.status === 'rejected') && (
          <div style={{ textAlign: 'center', padding: '20px', background: '#1a0a0a', border: '0.5px solid #dc2626', borderRadius: '8px' }}>
            <div style={{ color: '#dc2626', fontWeight: 700, fontSize: '14px' }}>Quote Declined</div>
            <div style={{ color: '#7a3a3a', fontSize: '11px', marginTop: '4px' }}>{settings.companyName} has been notified.</div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '9px', color: '#333' }}>{settings.companyName} · {settings.website}</div>
      </div>
    </div>
  );
}

// ── PIN Access Screen ──────────────────────────────────────────────────────────
function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const { state } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const attempt = () => {
    const stored = state.billing.settings.viewPin;
    if (stored && pin === stored) {
      sessionStorage.setItem('inspireX_viewPin', pin);
      onSuccess();
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 1500);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ width: '280px', textAlign: 'center' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Inspire<span style={{ color: '#73F764' }}>X</span></div>
        <div style={{ fontSize: '10px', color: '#555', marginBottom: '28px' }}>Secure access</div>
        <div style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>Enter your PIN to continue</div>
        <input type="password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && attempt()}
          placeholder="Enter PIN" maxLength={6}
          style={{ width: '100%', padding: '10px 14px', background: error ? '#1a0a0a' : '#111', border: '0.5px solid ' + (error ? '#dc2626' : '#333'), borderRadius: '6px', color: '#fff', fontSize: '16px', textAlign: 'center', letterSpacing: '4px', outline: 'none', boxSizing: 'border-box' }} />
        {error && <div style={{ color: '#dc2626', fontSize: '11px', marginTop: '6px' }}>Incorrect PIN</div>}
        <button onClick={attempt} style={{ width: '100%', marginTop: '10px', padding: '10px', background: '#73F764', color: '#000', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          Enter
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { state } = useApp();

  // Check for approval token in URL hash
  const hash = window.location.hash;
  if (hash.startsWith('#approve/')) {
    const token = hash.slice(9);
    return <ApprovalPage token={token} />;
  }

  // Check PIN access mode
  const pinEnabled = state.billing.settings.viewPinEnabled;
  const pinValue = state.billing.settings.viewPin;
  const sessionPin = sessionStorage.getItem('inspireX_viewPin');
  const isViewOnly = pinEnabled && pinValue && sessionPin !== pinValue;

  if (isViewOnly) {
    return <PinScreen onSuccess={() => window.location.reload()} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onViewChange={setCurrentView} />;
      case 'calculator':
        return <ProjectCalculator />;
      case 'worklog':
        return <WorkLog />;
      case 'commitment':
        return <CommitmentTracker />;
      case 'summary':
        return <MonthlySummary />;
      case 'team':
        return <TeamManagement />;
      case 'capital':
        return <WorkingCapital />;
      case 'settings':
        return <Settings />;
      case 'billing':
        return <Billing />;
      default:
        return <Dashboard onViewChange={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main 
        className={`transition-all duration-300 min-h-screen ${
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        <div className="p-6 max-w-6xl mx-auto pb-24">
          {renderView()}
        </div>
      </main>
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1e1e1e',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#f0ede8',
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;


