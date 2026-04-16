import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useFocusMode } from "../hooks/useFocusMode";
import { useAuth } from "../context/AuthContext";
import { useEvents } from "../hooks/useEvents";
import { useClients } from "../hooks/useClients";
import { useInventory } from "../hooks/useInventory";
import { useAlterations } from "../hooks/useAlterations";
import { usePayments } from "../hooks/usePayments";
import { useAlertTaskCount } from "../hooks/useNotes";
import { useBoutique } from "../hooks/useBoutique";
import { useModules } from "../hooks/useModules.jsx";
import { useBilling } from "../hooks/useBilling";
import { useLocations } from "../hooks/useLocations";
import { C } from "../lib/colors";
import { ToastProvider, SkeletonDashboard } from "../lib/ui.jsx";
import { canAccess, defaultSettingsTab } from "../lib/permissions.js";
import { useI18n } from "../lib/i18n/index.jsx";
import Sidebar, { BottomNav, IconRail } from "../components/Sidebar.jsx";
import QuickActionFAB from "../components/QuickActionFAB";
import BugReportButton from "../components/BugReportButton";
import OfflineIndicator from "../components/OfflineIndicator";
import UpgradeModal from "../components/UpgradeModal";
import PageErrorBoundary from "../components/PageErrorBoundary.jsx";
import GlobalSearch from "../components/GlobalSearch.jsx";
import NotificationCenter, { useAlertCount } from "../components/NotificationCenter.jsx";
import KeyboardShortcutsModal from "../components/KeyboardShortcutsModal.jsx";
import Dashboard from "./Dashboard";
import {
  MeasurementsScreen, VendorsScreen, DressCatalogScreen, FBBeoScreen,
  FloorplanScreen, RetailScreen, StaffScheduleScreen,
  AuditLogScreen, WaitlistScreen, PhotoGalleryScreen, EmailMarketingScreen,
  TicketingScreen, ReviewsScreen, OnlinePaymentsScreen, ExpensesScreen,
  AccountingScreen,
} from "./ModuleStubs.jsx";

const EventsList    = lazy(() => import("./Events").then(m => ({ default: m.EventsList })));
const EventDetail   = lazy(() => import("./EventDetail"));
const DressRentals  = lazy(() => import("./DressRentals"));
const Inventory     = lazy(() => import("./Inventory"));
const Alterations   = lazy(() => import("./Alterations"));
const Payments      = lazy(() => import("./Payments"));
const Clients       = lazy(() => import("./Clients"));
const Settings      = lazy(() => import("./Settings"));
const QRCodesPage   = lazy(() => import("./QRCodesPage"));
const Reports           = lazy(() => import("./Reports"));
const DataExport    = lazy(() => import("./DataExport"));
const Calendar      = lazy(() => import("./Calendar"));
const StaffCalendar = lazy(() => import("./StaffCalendar"));
const RoadmapPage      = lazy(() => import("./RoadmapPage"));
const ReportBuilder    = lazy(() => import("./ReportBuilder"));
const PurchaseOrders   = lazy(() => import("./PurchaseOrders"));
const POSPage          = lazy(() => import("./POSPage"));
const SmsInboxPage     = lazy(() => import("./SmsInboxPage"));
const VendorsPage      = lazy(() => import('./VendorsPage'));
const ExpensesPage     = lazy(() => import('./ExpensesPage'));
const QuoteBuilderPage = lazy(() => import('./QuoteBuilderPage'));
const ImportPage       = lazy(() => import('./ImportPage'));
const CommissionsPage  = lazy(() => import('./CommissionsPage'));
const PromoCodesPage   = lazy(() => import('./PromoCodesPage'));
const FunnelPage       = lazy(() => import('./FunnelPage'));
const MyTasksPage      = lazy(() => import('./MyTasksPage'));
const HelpPage         = lazy(() => import('./HelpPage'));
const ActivityFeed        = lazy(() => import('./ActivityFeed'));
const ClientLookupScreen  = lazy(() => import('./ClientLookupScreen'));
const BillingScreen       = lazy(() => import('./BillingScreen'));
const InvoiceCreateScreen = lazy(() => import('./InvoiceCreateScreen'));
const ConsultationScreen  = lazy(() => import('./ConsultationScreen'));
const AppointmentsScreen  = lazy(() => import('./AppointmentsScreen'));
const ScheduleScreen      = lazy(() => import('./ScheduleScreen'));
const BugReportsAdmin     = lazy(() => import('./BugReportsAdmin'));

// ─── Brand color helpers ─────────────────────────────────────────────────
function hexToPale(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return '#FDF5F6'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const m = (c) => Math.round(c * 0.10 + 255 * 0.90)
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

// ─── Wedding Planner Coming Soon screen ─────────────────────────────────────
const WeddingPlannerComingSoon = ({ setScreen, selectedEvent }) => (
  <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 24px',textAlign:'center',gap:24,background:'#FAFAFA'}}>
    <div style={{fontSize:56,lineHeight:1}}>💍</div>
    <div>
      <div style={{fontSize:24,fontWeight:700,color:'#1F2937',marginBottom:8}}>Wedding Planner</div>
      <div style={{fontSize:14,color:'#6B7280',maxWidth:420,lineHeight:1.7,margin:'0 auto'}}>
        A full planning suite with visual timelines, vendor coordination, run-of-show builder, guest management, and more — arriving as a Pro add-on.
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,width:'100%',maxWidth:380}}>
      {['📅 Visual event timeline','🤝 Vendor contacts & notes','🎬 Run-of-show builder','👥 Guest coordination','💰 Budget tracker','✉️ Client questionnaires'].map(f=>(
        <div key={f} style={{padding:'10px 14px',borderRadius:10,border:`1px solid #E5E7EB`,background:'#fff',fontSize:12,color:'#6B7280',textAlign:'left'}}>{f}</div>
      ))}
    </div>
    <span style={{fontSize:11,fontWeight:700,padding:'5px 16px',borderRadius:999,background:'#F3F4F6',color:'#9CA3AF',letterSpacing:'0.06em',textTransform:'uppercase'}}>Coming soon · Pro add-on</span>
    <button onClick={()=>setScreen(selectedEvent ? 'event_detail' : 'events')} style={{fontSize:13,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500,textDecoration:'underline'}}>{selectedEvent ? '← Back to event' : '← Back to events'}</button>
  </div>
);

const TrialBanner = ({ setScreen }) => {
  const { status, trialDaysLeft, isTrialing, hasActiveSubscription } = useBilling();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (status === 'active' && hasActiveSubscription) return null;
  if (status !== 'trialing' && status !== 'past_due' && status !== 'canceled') return null;

  const isPastDue  = status === 'past_due';
  const isCanceled = status === 'canceled';
  const urgent     = isTrialing && trialDaysLeft !== null && trialDaysLeft <= 3;

  const bg  = isPastDue || isCanceled ? '#FEF2F2' : urgent ? '#FFFBEB' : '#F0FDF4';
  const bdr = isPastDue || isCanceled ? '#FECACA' : urgent ? '#FDE68A' : '#BBF7D0';
  const col = isPastDue || isCanceled ? '#B91C1C' : urgent ? '#92400E' : '#15803D';
  const icon = isPastDue ? '⚠️' : isCanceled ? '🔒' : urgent ? '⏰' : '🎉';

  const msg = isCanceled
    ? 'Your subscription was canceled — upgrade to restore full access.'
    : isPastDue
    ? 'Payment failed — update your payment method to avoid losing access.'
    : trialDaysLeft === 0 ? 'Your free trial has ended. Upgrade to keep using Belori.'
    : trialDaysLeft === 1 ? '1 day left in your free trial!'
    : `${trialDaysLeft} days left in your free trial.`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 20px',
      background: bg, borderBottom: `1px solid ${bdr}`,
      flexShrink: 0, zIndex: 10,
    }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12, color: col, fontWeight: 500 }}>{msg}</span>
      <button
        onClick={() => { sessionStorage.setItem('belori_autoopen','tab_billing'); setScreen('settings'); }}
        style={{ padding: '5px 14px', borderRadius: 7, border: 'none', background: col, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
      >{isPastDue ? 'Update payment' : 'Upgrade now'} →</button>
      {isTrialing && trialDaysLeft > 3 && (
        <button onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', color: col, cursor: 'pointer', fontSize: 16, lineHeight: 1, opacity: 0.6, padding: '0 4px', flexShrink: 0 }}>×</button>
      )}
    </div>
  );
};

const Placeholder = ({ title, icon }) => (
  <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:C.gray,gap:8}}>
    <span style={{fontSize:32}}>{icon}</span>
    <span style={{fontSize:14}}>{title}</span>
  </div>
);

const AccessDenied = () => (
  <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:C.gray,gap:10}}>
    <span style={{fontSize:40}}>🔒</span>
    <span style={{fontSize:15,fontWeight:500,color:C.ink}}>Access restricted</span>
    <span style={{fontSize:13}}>You don't have permission to view this page.</span>
  </div>
);

const PageLoading = () => (
  <div style={{flex:1,overflow:'auto'}}>
    <SkeletonDashboard/>
  </div>
);

const SHORTCUT_ROWS = [
  { key: 'E', desc: 'Go to Events' },
  { key: 'C', desc: 'Go to Clients' },
  { key: 'P', desc: 'Go to Payments' },
  { key: 'A', desc: 'Go to Alterations' },
  { key: 'I', desc: 'Go to Inventory' },
  { key: '⌘K', desc: 'Global search' },
  { key: '?', desc: 'Show this panel' },
  { key: 'Esc', desc: 'Close panel' },
];

const ShortcutsHint = ({ onClose }) => {
  const panelRef = React.useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (panelRef.current && !panelRef.current.contains(e.target)) return;
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return (
    <div ref={panelRef} style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 600,
      background: C.white, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
      border: `1px solid ${C.border}`, padding: '16px 20px', minWidth: 240,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Keyboard shortcuts</span>
        <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {SHORTCUT_ROWS.map(({ key, desc }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ fontSize: 12, color: C.gray }}>{desc}</span>
            <kbd style={{
              fontSize: 11, fontWeight: 500, color: C.ink,
              background: C.ivory, border: `1px solid ${C.border}`,
              borderRadius: 5, padding: '2px 7px', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>{key}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function NovelApp() {
  const { session, boutique, boutiques, myRole, signOut, switchBoutique } = useAuth();
  const { setLang } = useI18n();
  const [screen,setScreen]=useState('dashboard');
  const [selectedEvent,setSelectedEvent]=useState(null);
  const [consultationProps,setConsultationProps]=useState({});

  // Clear consultationProps whenever we navigate away from the consultation screen
  // to prevent stale props from a previous event being shown on the next open
  useEffect(() => {
    if (screen !== 'consultation') setConsultationProps({});
  }, [screen]);
  const { focusMode, toggle: toggleFocus } = useFocusMode();
  const [showSearch,setShowSearch]=useState(false);
  const [showAlerts,setShowAlerts]=useState(false);
  const [showShortcuts,setShowShortcuts]=useState(false);
  const [settingsTab,setSettingsTab]=useState('profile');
  const [upgradeModal,setUpgradeModal]=useState(null); // null or { feature, minPlan }

  // Inject mobile CSS once
  useEffect(() => {
    const id = 'belori-mobile-css';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      @media (max-width: 768px) {
        .sidebar-full { display: none !important; }
        .sidebar-icons { display: none !important; }
        .belori-main { padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px)) !important; }
        .topbar { padding: 8px 14px !important; min-height: 48px !important; }
        .topbar-hide { display: none !important; }
        .topbar-actions { gap: 6px !important; }
        .page-scroll { -webkit-overflow-scrolling: touch; }
      }
      @media (min-width: 769px) {
        .bottom-nav { display: none !important; }
      }
      input:focus, select:focus, textarea:focus {
        outline: none;
        border-color: #C9697A !important;
        box-shadow: 0 0 0 3px rgba(201, 105, 122, 0.20);
      }
      input:disabled, select:disabled, textarea:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(s);
  }, []);

  // Listen for upgrade gate events fired from anywhere in the app
  useEffect(() => {
    const handler = (e) => setUpgradeModal(e.detail);
    document.addEventListener('belori:show-upgrade', handler);
    return () => document.removeEventListener('belori:show-upgrade', handler);
  }, []);

  // Sync language from boutique settings when boutique loads
  useEffect(() => {
    if (boutique?.language) {
      // localStorage takes precedence (user's device preference); fall back to boutique default
      if (!localStorage.getItem('belori_lang')) {
        setLang(boutique.language);
      }
    }
  }, [boutique?.id, boutique?.language]);

  // Legacy/renamed screen aliases — resolved here so render() never calls setState()
  const SCREEN_ALIASES = { staff_calendar: 'schedule', appointments: 'schedule', invoices: 'billing' };

  // Wrap setScreen to intercept settings navigation hints + enforce permissions
  const goScreen = useCallback((s) => {
    const resolved = SCREEN_ALIASES[s] ?? s; // resolve aliases before permission check
    if (!canAccess(myRole, resolved)) return; // silently block unauthorised navigation
    if(resolved==='settings'){
      const hint=sessionStorage.getItem('belori_autoopen');
      if(hint==='tab_packages'){sessionStorage.removeItem('belori_autoopen');setSettingsTab('packages');}
      else if(hint==='tab_billing'){sessionStorage.removeItem('belori_autoopen');setSettingsTab('billing');}
      else{setSettingsTab(defaultSettingsTab(myRole));}
    }
    setScreen(resolved);
  },[myRole]);

  // ⌘K / Ctrl+K opens global search
  useEffect(()=>{
    const handler=(e)=>{
      if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setShowSearch(s=>!s);}
    };
    window.addEventListener('keydown',handler);
    return ()=>window.removeEventListener('keydown',handler);
  },[]);

  // belori:open-search custom event (dispatched from Sidebar or anywhere)
  useEffect(()=>{
    const handler=()=>setShowSearch(true);
    window.addEventListener('belori:open-search',handler);
    return ()=>window.removeEventListener('belori:open-search',handler);
  },[]);

  // Single-key nav shortcuts (only when no input/textarea/select is focused)
  useEffect(()=>{
    const handler=(e)=>{
      if(e.metaKey||e.ctrlKey||e.altKey) return;
      const tag=document.activeElement?.tagName?.toLowerCase();
      if(['input','textarea','select'].includes(tag)) return;
      switch(e.key){
        case 'e': goScreen('events'); break;
        case 'c': goScreen('clients'); break;
        case 'p': goScreen('payments'); break;
        case 'a': goScreen('alterations'); break;
        case 'i': goScreen('inv_full'); break;
        case '?': setShowShortcuts(s=>!s); break;
        case 'Escape': setShowShortcuts(false); break;
        default: break;
      }
    };
    window.addEventListener('keydown',handler);
    return ()=>window.removeEventListener('keydown',handler);
  },[goScreen]);

  const { isEnabled } = useModules();
  const { events, loading: eventsLoading, createEvent, updateEvent, duplicateEvent, deleteEvent } = useEvents();
  const { clients, loading: clientsLoading, createClient, updateClient, adjustLoyaltyPoints, redeemPoints, adjustPoints, mergeClients } = useClients();
  const { inventory, updateDress, createDress } = useInventory({ enabled: isEnabled('dress_rental') });
  const { alterations, createJob, updateJob, cancelJob, deleteJob, logTimeEntry } = useAlterations({ enabled: isEnabled('alterations') });
  const { payments, loading: paymentsLoading, refunds, markPaid, createMilestone, createMilestones, logReminder, deleteMilestone, logRefund, logTip } = usePayments();
  const alertCount = useAlertCount({ events, payments, inventory });
  const alertTaskCount = useAlertTaskCount();
  const { getStaff } = useBoutique();
  const [staff,setStaff]=useState([]);
  // Reload staff when boutique changes (e.g. multi-boutique switch) — fixes stale closure bug
  useEffect(()=>{getStaff&&getStaff().then(({data})=>{if(data?.length)setStaff(data);});},[boutique?.id]);

  const sidebarBadges = React.useMemo(() => ({
    events: events?.filter(e=>e.status!=='completed'&&e.status!=='cancelled').length || 0,
    alterations: alterations?.filter(a=>!['complete','cancelled'].includes(a.status)).length || 0,
    payments: payments?.filter(p => p.status !== 'paid' && p.due_date && new Date(p.due_date) < new Date()).length || 0,
    inv_full: inventory?.filter(item=>{
      if(item.track==='consumable') return item.restockPoint>0&&item.currentStock<=item.restockPoint;
      if(item.track==='quantity') return item.minStock>0&&item.availQty<=item.minStock;
      return false;
    }).length || 0,
    tasks: 0,
    myTasks: alertTaskCount,
  }), [events, alterations, payments, inventory, alertTaskCount]);
  const en = (id) => isEnabled(id);
  const { locations, activeLocation, setActiveLocation } = useLocations();

  const renderScreen = () => {
    // Gate every non-dashboard screen by role permissions
    if (screen !== 'dashboard' && !canAccess(myRole, screen)) return <AccessDenied />;
    switch(screen){
      case 'dashboard':     return <Dashboard setScreen={goScreen} setSelectedEvent={setSelectedEvent} events={events} payments={payments} inventory={inventory} boutique={boutique} clients={clients} staff={staff} alterations={alterations} focusMode={focusMode} onToggleFocus={toggleFocus}/>;
      case 'my_tasks':      return <Suspense fallback={<PageLoading/>}><MyTasksPage setScreen={goScreen} setSelectedEvent={setSelectedEvent}/></Suspense>;
      case 'events':        return <EventsList setScreen={goScreen} setSelectedEvent={setSelectedEvent} events={events} eventsLoading={eventsLoading} createEvent={createEvent} duplicateEvent={duplicateEvent} clients={clients} inventory={inventory} alterations={alterations}/>;
      case 'event_detail':  return <EventDetail eventId={selectedEvent} setScreen={goScreen} setSelectedEvent={setSelectedEvent} allEvents={events} updateEvent={updateEvent} deleteEvent={deleteEvent} markPaid={markPaid} createMilestone={createMilestone} createMilestones={createMilestones} deleteMilestone={deleteMilestone} createJob={createJob} updateJob={updateJob} updateClient={updateClient} updateDress={updateDress} staff={staff} inventory={inventory} logRefund={logRefund} logTip={logTip} refunds={(refunds||[]).filter(r => r.event_id === selectedEvent)} setConsultationProps={setConsultationProps}/>;
      case 'clients':       return <Clients setScreen={goScreen} setSelectedEvent={setSelectedEvent} clients={clients} clientsLoading={clientsLoading} createClient={createClient} updateClient={updateClient} adjustLoyaltyPoints={adjustLoyaltyPoints} redeemPoints={redeemPoints} adjustPoints={adjustPoints} mergeClients={mergeClients} inventory={inventory}/>;
      case 'alterations':   return en('alterations')    ? <Alterations alterations={alterations} staff={staff} clients={clients} createClient={createClient} createJob={createJob} updateJob={updateJob} cancelJob={cancelJob} deleteJob={deleteJob} logTimeEntry={logTimeEntry}/> : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'inventory':     return en('dress_rental')   ? <DressRentals inventory={inventory} updateDress={updateDress} createDress={createDress} createJob={createJob} events={events} clients={clients} staff={staff} setScreen={goScreen} setSelectedEvent={setSelectedEvent}/> : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'inv_full':      return en('decoration')     ? <Inventory inventory={inventory} updateDress={updateDress} createDress={createDress} events={events} updateEvent={updateEvent} clients={clients} setScreen={goScreen}/> : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'qr_labels':     return <QRCodesPage setScreen={goScreen}/>;
      case 'schedule':      return <Suspense fallback={<PageLoading/>}><ScheduleScreen setScreen={goScreen} setSelectedEvent={setSelectedEvent} events={events} staff={staff} clients={clients}/></Suspense>;
      case 'calendar':      return <Calendar events={events} setScreen={goScreen} setSelectedEvent={setSelectedEvent} staff={staff} clients={clients}/>;
      case 'staff_calendar': return null; // resolved to 'schedule' by goScreen alias
      case 'payments':      return <Payments payments={payments} paymentsLoading={paymentsLoading} markPaid={markPaid} logReminder={logReminder} deleteMilestone={deleteMilestone} createMilestone={createMilestone} setScreen={goScreen} setSelectedEvent={setSelectedEvent} events={events}/>;
      case 'settings':      return <Settings boutique={boutique} initialTab={settingsTab} setScreen={goScreen}/>;
      case 'reports':       return en('reports')        ? <Reports payments={payments} events={events} clients={clients} goScreen={goScreen}/> : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'report_builder': return en('reports')       ? <ReportBuilder /> : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'data_export':   return en('data_export')    ? <DataExport clients={clients} events={events} payments={payments} inventory={inventory}/> : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'measurements':  return en('measurements')   ? <MeasurementsScreen/>    : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'vendors':       return en('vendors')        ? <Suspense fallback={<PageLoading/>}><VendorsPage /></Suspense> : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'dress_catalog': return en('dress_catalog')  ? <DressCatalogScreen inventory={inventory}/> : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'fb_beo':        return en('fb_beo')         ? <FBBeoScreen/>           : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'floorplan':     return en('floorplan')      ? <FloorplanScreen/>       : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'pos':           return en('pos')            ? <POSPage inventory={inventory} clients={clients} events={events}/> : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'retail':        return en('retail')         ? <RetailScreen/>          : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'staff_sched':   return en('staff_sched')    ? <StaffScheduleScreen/>   : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'audit_ui':      return en('audit_ui')       ? <AuditLogScreen/>        : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'waitlist':      return en('waitlist')       ? <WaitlistScreen/>        : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'photo_gallery': return en('photo_gallery')  ? <PhotoGalleryScreen/>    : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'email_mkt':     return en('email_marketing')? <EmailMarketingScreen/>  : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'ticketing':     return en('ticketing')      ? <TicketingScreen/>       : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'reviews':       return en('reviews')        ? <ReviewsScreen/>         : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'online_pay':    return en('online_payments')? <OnlinePaymentsScreen/>  : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'expenses':      return en('expenses')       ? <Suspense fallback={<PageLoading/>}><ExpensesPage events={events} setScreen={goScreen} setSelectedEvent={setSelectedEvent}/></Suspense> : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'commissions':   return <Suspense fallback={<PageLoading/>}><CommissionsPage /></Suspense>;
      case 'promo_codes':   return <Suspense fallback={<PageLoading/>}><PromoCodesPage /></Suspense>;
      case 'funnel':        return <Suspense fallback={<PageLoading/>}><FunnelPage /></Suspense>;
      case 'quote_builder': return <Suspense fallback={<PageLoading/>}><QuoteBuilderPage /></Suspense>;
      case 'bulk_import':   return <Suspense fallback={<PageLoading/>}><ImportPage /></Suspense>;
      case 'accounting':    return en('accounting')     ? <AccountingScreen payments={payments} events={events}/> : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'purchase_orders': return en('purchase_orders') ? <PurchaseOrders goScreen={goScreen}/> : <Placeholder title="Module Disabled" icon="🔒"/>;
      case 'wedding_planner': return <WeddingPlannerComingSoon setScreen={goScreen} selectedEvent={selectedEvent}/>;
      case 'bug_reports':   return <Suspense fallback={<PageLoading/>}><BugReportsAdmin setScreen={goScreen}/></Suspense>;
      case 'roadmap':       return <RoadmapPage />;
      case 'sms_inbox':     return <SmsInboxPage />;
      case 'help':          return <Suspense fallback={<PageLoading/>}><HelpPage /></Suspense>;
      case 'activity_feed':  return <Suspense fallback={<PageLoading/>}><ActivityFeed setScreen={goScreen}/></Suspense>;
      case 'client_lookup':   return <Suspense fallback={<PageLoading/>}><ClientLookupScreen setScreen={goScreen}/></Suspense>;
      case 'billing':         return <Suspense fallback={<PageLoading/>}><BillingScreen setScreen={goScreen}/></Suspense>;
      case 'invoices':        return null; // resolved to 'billing' by goScreen alias
      case 'invoice_create':  return <Suspense fallback={<PageLoading/>}><InvoiceCreateScreen setScreen={goScreen}/></Suspense>;
      case 'invoice_detail':  return null; // detail is handled inline in BillingScreen; goScreen alias resolves if needed
      case 'consultation':    return <Suspense fallback={<PageLoading/>}><ConsultationScreen {...consultationProps} setScreen={goScreen}/></Suspense>;
      case 'appointments':   return null; // resolved to 'schedule' by goScreen alias
      default:               return <Dashboard setScreen={goScreen} setSelectedEvent={setSelectedEvent} events={events} payments={payments} inventory={inventory} boutique={boutique} clients={clients} staff={staff} alterations={alterations}/>;
    }
  };

  return (
    <ToastProvider>
    <OfflineIndicator />
    <div style={{
      height:'100vh',display:'flex',background:'var(--bg-primary, #F8F4F0)',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif',
      overflow:'hidden',
      '--brand-primary': boutique?.primary_color || '#C9697A',
      '--brand-pale': hexToPale(boutique?.primary_color || '#C9697A'),
    }}>
      <a
        href="#main-content"
        onFocus={e => { e.currentTarget.style.top = '0'; e.currentTarget.style.left = '0'; }}
        onBlur={e => { e.currentTarget.style.top = '-9999px'; e.currentTarget.style.left = '-9999px'; }}
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          zIndex: 10000,
          background: '#1C1012',
          color: '#FFFFFF',
          padding: '10px 20px',
          borderRadius: '0 0 10px 0',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Skip to main content
      </a>
      <Sidebar screen={screen} setScreen={goScreen} boutique={boutique} boutiques={boutiques} onSwitchBoutique={switchBoutique} onSignOut={signOut} badges={sidebarBadges} onSearch={()=>setShowSearch(true)} alertCount={alertCount} onAlerts={()=>setShowAlerts(s=>!s)} myRole={myRole} focusMode={focusMode} onToggleFocus={toggleFocus} onShortcuts={()=>setShowShortcuts(s=>!s)}/>
      <IconRail screen={screen} setScreen={goScreen} onSignOut={signOut} boutique={boutique} boutiques={boutiques} onSwitchBoutique={switchBoutique} badges={sidebarBadges} onSearch={()=>setShowSearch(true)} myRole={myRole}/>
      <div id="main-content" tabIndex={-1} className="belori-main" style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
        <TrialBanner setScreen={goScreen}/>
        {locations.length > 1 && (
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 20px',background:C.white,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
            <span style={{fontSize:11,color:C.gray}}>Location:</span>
            <select value={activeLocation?.id||''} onChange={e => setActiveLocation(locations.find(l=>l.id===e.target.value))}
              style={{fontSize:11,border:`1px solid ${C.border}`,borderRadius:6,padding:'3px 8px',background:C.white,color:C.ink,cursor:'pointer'}}>
              {locations.map(l => <option key={l.id} value={l.id}>📍 {l.name}</option>)}
            </select>
          </div>
        )}
        <PageErrorBoundary key={screen} style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
          <Suspense fallback={<PageLoading/>}>
            <div key={screen} style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0,animation:'pageFadeIn 120ms ease-out'}}>
              {renderScreen()}
            </div>
          </Suspense>
        </PageErrorBoundary>
      </div>
      <BottomNav screen={screen} setScreen={goScreen} badges={sidebarBadges}/>
      {showSearch&&<GlobalSearch isOpen={showSearch} setScreen={goScreen} setSelectedEvent={setSelectedEvent} onClose={()=>setShowSearch(false)}/>}
      {showAlerts&&(
        <div style={{position:'fixed',bottom:68,left:8,right:8,maxWidth:352,zIndex:400}}>
          <NotificationCenter events={events} payments={payments} inventory={inventory} setScreen={goScreen} setSelectedEvent={setSelectedEvent} onClose={()=>setShowAlerts(false)}/>
        </div>
      )}
      {showShortcuts&&<KeyboardShortcutsModal onClose={()=>setShowShortcuts(false)}/>}
      {upgradeModal&&<UpgradeModal feature={upgradeModal.feature} minPlan={upgradeModal.minPlan} onClose={()=>setUpgradeModal(null)}/>}
      <QuickActionFAB setScreen={goScreen}/>
      <BugReportButton currentScreen={screen}/>
    </div>
    </ToastProvider>
  );
}
