import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { Sidebar, NotificationPanel } from '@/components/Sidebar';
import { Dashboard } from '@/sections/Dashboard';
import { ProjectCalculator } from '@/sections/ProjectCalculator';
import { WorkLog } from '@/sections/WorkLog';
import { CommitmentTracker } from '@/sections/CommitmentTracker';
import { MonthlySummary } from '@/sections/MonthlySummary';
import { TeamManagement } from '@/sections/TeamManagement';
import { Settings } from '@/sections/Settings';
import { Billing } from '@/sections/Billing';
import type { BillingView } from '@/sections/Billing';
import { WorkingCapital } from '@/sections/WorkingCapital';
import { TasksAndScoring } from '@/sections/TasksAndScoring';
import { AppProvider, useApp } from '@/hooks/useAppState';
import { Toaster } from '@/components/ui/sonner';
import type { ViewType } from '@/types';
import type { BillingDocument } from '@/types';

// ── Quote PDF for Approval Page ───────────────────────────────────────────────
function downloadApprovalPDF(doc: any, clientName: string, settings: any, sym: string) {
  const lineItems: any[] = doc.lineItems || [];
  const ROW_H = 8;
  const BASE_H = 120 + lineItems.length * ROW_H + (doc.notes ? 20 : 0);
  const totalH = Math.max(BASE_H, 120);

  const pdf = new jsPDF({ unit: 'mm', format: [210, totalH], orientation: 'portrait' });
  const W = 210, M = 18, CW = W - M * 2;
  let y = M + 2;

  // Background
  pdf.setFillColor('#0D0D0D');
  pdf.rect(0, 0, W, totalH, 'F');

  // Logo / company name
  if (settings.logoBase64) {
    try {
      const ext = settings.logoBase64.includes('image/png') ? 'PNG' : 'JPEG';
      const ti = document.createElement('img'); ti.src = settings.logoBase64;
      const nw = ti.naturalWidth || 400, nh = ti.naturalHeight || 120;
      const lw = Math.min(Math.max(settings.logoWidth || 50, 20), 80);
      const lh = settings.logoHeight && settings.logoHeight > 0 ? settings.logoHeight : Math.min(Math.max(+(lw * nh / nw).toFixed(1), 7), 22);
      pdf.addImage(settings.logoBase64, ext, M, y - 2, lw, lh);
      y += lh + 2;
    } catch {
      pdf.setFontSize(18); pdf.setFont('helvetica', 'bold');
      pdf.setTextColor('#FFFFFF'); pdf.text('Inspire', M, y);
      pdf.setTextColor('#73F764'); pdf.text('X', M + pdf.getTextWidth('Inspire'), y);
      y += 7;
    }
  } else {
    pdf.setFontSize(18); pdf.setFont('helvetica', 'bold');
    pdf.setTextColor('#FFFFFF'); pdf.text('Inspire', M, y);
    pdf.setTextColor('#73F764'); pdf.text('X', M + pdf.getTextWidth('Inspire'), y);
    y += 7;
  }
  if (settings.tagline) {
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#555555');
    pdf.text(settings.tagline, M, y); y += 4;
  }

  // QUOTE label top right
  const headerY = M + 2;
  pdf.setFontSize(20); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#73F764');
  pdf.text('QUOTE', W - M, headerY + 5, { align: 'right' });
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#888888');
  pdf.text('# ' + doc.number, W - M, headerY + 11, { align: 'right' });

  // Green divider
  pdf.setDrawColor('#73F764'); pdf.setLineWidth(0.5);
  pdf.line(M, y, W - M, y); y += 6;

  // Client + date info
  pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#AAAAAA');
  pdf.text('Prepared for', M, y);
  pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#FFFFFF');
  pdf.text(clientName, M + 24, y); y += 5;
  if (doc.projectName) {
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#888888');
    pdf.text('Project: ' + doc.projectName, M, y); y += 5;
  }
  if (doc.validUntil) {
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#555555');
    pdf.text('Valid until: ' + doc.validUntil, M, y); y += 5;
  }
  y += 2;

  // Line items table header
  const tableStartY = y;
  pdf.setFillColor('#111111');
  pdf.rect(M, y, CW, 7, 'F');
  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#888888');
  pdf.text('Description', M + 3, y + 4.5);
  pdf.text('Qty', W - M - 48, y + 4.5, { align: 'right' });
  pdf.text('Unit Price', W - M - 22, y + 4.5, { align: 'right' });
  pdf.text('Total', W - M - 2, y + 4.5, { align: 'right' });
  y += 7;

  // Line items rows
  lineItems.forEach((item: any, i: number) => {
    pdf.setFillColor(i % 2 === 0 ? '#0A0A0A' : '#0D0D0D');
    pdf.rect(M, y, CW, ROW_H, 'F');
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#DDDDDD');
    const descLines = pdf.splitTextToSize(item.description?.split('\n')[0] || '', 90);
    pdf.text(descLines[0], M + 3, y + 5);
    pdf.setTextColor('#AAAAAA');
    pdf.text(String(item.qty ?? ''), W - M - 48, y + 5, { align: 'right' });
    pdf.text(sym + ' ' + (item.unitPrice ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 }), W - M - 22, y + 5, { align: 'right' });
    pdf.setTextColor('#FFFFFF');
    pdf.text(sym + ' ' + (item.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 }), W - M - 2, y + 5, { align: 'right' });
    y += ROW_H;
  });
  // Outer rounded border around table
  pdf.setDrawColor('#2a2a2a'); pdf.setLineWidth(0.3);
  pdf.roundedRect(M, tableStartY, CW, y - tableStartY, 1.5, 1.5, 'S');

  // Total row
  y += 2;
  pdf.setDrawColor('#1E1E1E'); pdf.setLineWidth(0.3);
  pdf.line(M, y, W - M, y); y += 5;
  pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
  pdf.setTextColor('#888888'); pdf.text('Total', M, y);
  pdf.setTextColor('#73F764'); pdf.text(sym + ' ' + (doc.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 }), W - M - 2, y, { align: 'right' });
  y += 8;

  // Notes
  if (doc.notes) {
    pdf.setDrawColor('#1E1E1E'); pdf.setLineWidth(0.3);
    pdf.line(M, y, W - M, y); y += 5;
    pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#666666');
    const noteLines = pdf.splitTextToSize(doc.notes, CW);
    noteLines.forEach((line: string) => { pdf.text(line, M, y); y += 4; });
    y += 2;
  }

  // Footer
  pdf.setDrawColor('#1E1E1E'); pdf.setLineWidth(0.3);
  pdf.line(M, totalH - 12, W - M, totalH - 12);
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#444444');
  pdf.text(settings.companyName + (settings.website ? ' · ' + settings.website : ''), M, totalH - 7);
  pdf.text(new Date().toLocaleDateString('en-GB'), W - M, totalH - 7, { align: 'right' });

  pdf.save(doc.number + '.pdf');
}

// ── Quote Approval Page ────────────────────────────────────────────────────────
function ApprovalPage({ token }: { token: string }) {
  const { state, dispatch } = useApp();
  const [status, setStatus] = useState<'pending' | 'approved' | 'declined'>('pending');

  // ── Decode self-contained base64 payload (works in any browser / any device) ──
  // Tries new base64url format first, falls back to old btoa(encodeURIComponent()) format
  let payload: any = null;
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - b64.length % 4);
    const binStr = atob(b64 + pad);
    const bytes = Uint8Array.from(binStr, c => c.charCodeAt(0));
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    try { payload = JSON.parse(decodeURIComponent(atob(token))); } catch {}
  }
  // Expand compact payload (short keys) → full keys for backward compatibility
  if (payload && payload.n !== undefined) {
    payload = {
      number: payload.n, total: payload.tot, currency: payload.cur,
      lineItems: (payload.li || []).map((i: any) => ({ description: i.d, qty: i.q, unitPrice: i.u, total: i.t })),
      notes: payload.no || '', validUntil: payload.vu || '', expiresAt: payload.ea,
      projectName: payload.pn || '', docStatus: payload.ds,
      companyName: payload.cn, companyEmail: payload.ce,
      website: payload.w || '', tagline: payload.tg || '', clientName: payload.cl,
    };
  }

  // ── Fallback: local state lookup for old-style token links (same browser only) ──
  const docFromState = !payload
    ? state.billing.documents.find((d: BillingDocument) => d.approvalToken === token)
    : undefined;

  const settings = payload
    ? { companyName: payload.companyName, email: payload.companyEmail, website: payload.website, tagline: payload.tagline, logoBase64: state.billing.settings.logoBase64 || undefined }
    : state.billing.settings;

  const doc: any = payload
    ? { number: payload.number, total: payload.total, currency: payload.currency, lineItems: payload.lineItems || [], notes: payload.notes, validUntil: payload.validUntil, projectName: payload.projectName, status: payload.docStatus, payments: [] }
    : docFromState;

  const clientName = payload
    ? payload.clientName
    : (state.billing.clients.find((c: any) => c.id === docFromState?.clientId)?.name || 'Client');

  // Track open count — only meaningful in same-browser context
  useEffect(() => {
    if (docFromState && (docFromState.approvalOpenedCount === 0 || docFromState.approvalOpenedCount === undefined)) {
      dispatch({ type: 'BILLING_UPDATE_DOCUMENT', payload: { ...docFromState, approvalOpenedCount: (docFromState.approvalOpenedCount || 0) + 1, updatedAt: new Date().toISOString() } });
    }
  }, []);

  const respond = (action: 'approved' | 'declined') => {
    if (!doc) return;
    // Update local state only when running in the same browser (owner testing the link)
    if (docFromState) {
      dispatch({ type: 'BILLING_UPDATE_DOCUMENT', payload: { ...docFromState, status: action === 'approved' ? 'accepted' : 'rejected', updatedAt: new Date().toISOString() } });
    }
    setStatus(action);
    const subject = encodeURIComponent((action === 'approved' ? 'Quote Approved — ' : 'Quote Declined — ') + doc.number);
    const body = encodeURIComponent(
      'Hi ' + settings.companyName + ',\n\n' +
      (action === 'approved'
        ? 'I am pleased to confirm that I approve Quote ' + doc.number + ' for the amount of ' + doc.total.toLocaleString() + ' ' + doc.currency + '.\n\nPlease proceed with the project.'
        : 'After consideration, I have decided to decline Quote ' + doc.number + '.\n\nThank you for the proposal.') +
      '\n\nRegards,\n' + clientName
    );
    window.open('mailto:' + settings.email + '?subject=' + subject + '&body=' + body);
  };

  useEffect(() => {
    document.title = settings.companyName || 'InspireX Studio Lab';
    return () => { document.title = 'InspireX Studio Lab'; };
  }, [settings.companyName]);

  if (!doc) return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✕</div>
        <div style={{ fontSize: '16px', color: '#fff', marginBottom: '8px' }}>Quote not found</div>
        <div style={{ fontSize: '12px' }}>This link may have been removed.</div>
      </div>
    </div>
  );

  // Check expiry
  const today = new Date().toISOString().slice(0, 10);
  if (payload?.expiresAt && payload.expiresAt < today) return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏰</div>
        <div style={{ fontSize: '16px', color: '#fff', marginBottom: '8px' }}>Approval link expired</div>
        <div style={{ fontSize: '12px' }}>This quote link expired on {payload.expiresAt}. Please contact {settings.companyName} for a new link.</div>
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
          {doc.lineItems.map((item: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < doc.lineItems.length - 1 ? '0.5px solid #1a1a1a' : 'none' }}>
              <div style={{ color: '#ddd', fontSize: '11px' }}>{item.description.split('\n')[0]}</div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap', marginLeft: '12px' }}>{sym} {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          ))}
        </div>

        {/* Notes */}
        {doc.notes && <div style={{ fontSize: '10px', color: '#666', marginBottom: '16px', lineHeight: 1.6 }}>{doc.notes}</div>}

        {/* Download PDF */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => downloadApprovalPDF(doc, clientName, settings, sym)}
            style={{ width: '100%', padding: '10px', background: '#111', color: '#73F764', borderRadius: '6px', border: '0.5px solid #73F764', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            ↓ Download PDF
          </button>
        </div>

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

  const logo = state.billing.settings.logoBase64;

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ width: '280px', textAlign: 'center' }}>
        {logo
          ? <img src={logo} alt="logo" style={{ height: '36px', objectFit: 'contain', display: 'block', margin: '0 auto 8px' }} />
          : <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Inspire<span style={{ color: '#73F764' }}>X</span></div>}
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
  const [billingView, setBillingView] = useState<BillingView>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { state } = useApp();

  // Check for approval token in URL hash
  // Supports both formats:
  //   New: #approve/project-name-slug/TOKEN  (slug is human-readable, TOKEN is base64url)
  //   Old: #approve/TOKEN                    (backward-compat)
  const hash = window.location.hash;
  if (hash.startsWith('#approve/')) {
    const rest = hash.slice(9);
    const slashIdx = rest.indexOf('/');
    const token = slashIdx >= 0 ? rest.slice(slashIdx + 1) : rest;
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
      case 'tasks':
        return <TasksAndScoring />;
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
        return <Billing view={billingView} onViewChange={setBillingView} />;
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
        billingView={billingView}
        onBillingViewChange={setBillingView}
      />
      {/* Fixed top bar */}
      <div
        className="fixed top-0 right-0 z-40 h-12 bg-card border-b border-border flex items-center justify-end px-4 gap-3 transition-all duration-300"
        style={{ left: sidebarCollapsed ? '4rem' : '16rem' }}
      >
        <NotificationPanel collapsed={false} />
      </div>
      <main
        className={`transition-all duration-300 min-h-screen ${
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        <div className="p-6 max-w-6xl mx-auto pt-16 pb-24">
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


