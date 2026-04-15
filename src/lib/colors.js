// ─── BRAND COLORS ──────────────────────────────────────────────────────────
export const C = {
  rosa:'#C9697A', rosaHov:'#B85868', rosaLight:'#E8B4BB', rosaPale:'#FDF5F6', rosaText:'#8B3A4A', rosaSolid:'#A84D5E',  // 5.40:1 on white — WCAG AA for white button text
  ink:'#1C1012', inkMid:'#4A2030', inkLight:'#9E7880',
  champagne:'#8B7355', ivory:'#F8F4F0', blush:'#FDF5F6', petal:'#E8B4BB',
  green:'#15803D', greenBg:'#DCFCE7',
  amber:'#B45309', amberBg:'#FEF3C7',
  red:'#B91C1C', redBg:'#FEE2E2',
  blue:'#1D4ED8', blueBg:'#DBEAFE',
  purple:'#7C3AED', purpleBg:'#EDE9FE',
  border:'#E5E7EB', borderDark:'#D1D5DB',
  gray:'#6B7280', grayBg:'#F9FAFB',
  white:'#FFFFFF',

  // Semantic aliases — mirror the CSS variables in index.html
  success:'#10B981', successBg:'#D1FAE5', successText:'#065F46',
  danger:'#DC2626',  dangerBg:'#FEF2F2',  dangerBorder:'#FECACA',
  warning:'#F59E0B', warningBg:'#FEF3C7', warningText:'#92400E',
  info:'#3B82F6',    infoBg:'#EFF6FF',    infoBorder:'#BFDBFE',   infoText:'#1E40AF',
  purpleBorder:'#DDD6FE', purpleText:'#5B21B6', purplePale:'#F5F3FF',
};

// ─── UTILITIES ─────────────────────────────────────────────────────────────
export function fmt(n) {
  const symbol = localStorage.getItem('belori_currency_symbol') || '$'
  if (!n && n !== 0) return `${symbol}0`
  return `${symbol}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
export const pct = (paid,total) => total > 0 ? Math.round((paid/total)*100) : 0;
export const SVC_LABELS = {dress_rental:'Dress rental',alterations:'Alterations',planning:'Event planning',decoration:'Decoration',photography:'Photography',dj:'DJ / Music',photobooth:'Photo Booth',custom_sneakers:'Custom Sneakers'};
export const SVC_COLORS = {
  dress_rental:{bg:'var(--bg-success)',text:'var(--text-success)'},
  alterations:{bg:'var(--bg-info)',text:'var(--text-info)'},
  planning:{bg:'var(--bg-accent)',text:'var(--text-accent)'},
  decoration:{bg:'var(--bg-warning)',text:'var(--text-warning)'},
  photography:{bg:'#FFF7ED',text:'#C2410C'},
  dj:{bg:'#F5F3FF',text:'#5B21B6'},
  photobooth:{bg:'#FDF4FF',text:'#7E22CE'},
  custom_sneakers:{bg:'#F0FDF4',text:'#15803D'},
};
export const EVT_TYPES = {
  wedding:      {label:'Wedding',        bg:C.rosaPale,  col:C.rosaText, icon:'💍'},
  quince:       {label:'Quinceañera',    bg:'var(--bg-accent)',  col:'var(--text-accent)',  icon:'👑'},
  baptism:      {label:'Baptism',        bg:'var(--bg-info)',    col:'var(--text-info)',    icon:'🕊️'},
  birthday:     {label:'Birthday',       bg:'var(--bg-warning)', col:'var(--text-warning)', icon:'🎂'},
  anniversary:  {label:'Anniversary',    bg:C.rosaPale,  col:C.rosaText, icon:'💕'},
  graduation:   {label:'Graduation',     bg:'var(--bg-success)',   col:'var(--text-success)',   icon:'🎓'},
  baby_shower:  {label:'Baby Shower',    bg:'#E0F2FE',   col:'#0369A1', icon:'🍼'},
  bridal_shower:{label:'Bridal Shower',  bg:'#FDF2F8',   col:'#9D174D', icon:'💐'},
};
// Services available and pre-selected per event type
export const TYPE_SVCS = {
  wedding:      ['dress_rental','alterations','decoration','photography','dj','photobooth','custom_sneakers'],
  quince:       ['dress_rental','alterations','decoration','photography','dj','photobooth','custom_sneakers'],
  bridal_shower:['dress_rental','alterations','decoration','photography','photobooth'],
  baptism:      ['decoration','photography','photobooth'],
  birthday:     ['decoration','photography','dj','photobooth'],
  anniversary:  ['decoration','photography','photobooth'],
  graduation:   ['decoration','photography','dj','photobooth','custom_sneakers'],
  baby_shower:  ['decoration','photography','photobooth'],
};
export const TYPE_DEFAULT_SVCS = {
  wedding:      ['dress_rental','alterations','decoration'],
  quince:       ['dress_rental','alterations','decoration'],
  bridal_shower:['decoration'],
  baptism:      ['decoration'],
  birthday:     ['decoration'],
  anniversary:  ['decoration'],
  graduation:   ['decoration'],
  baby_shower:  ['decoration'],
};
export const COLOR_PRESETS=[
  {name:'Rose gold',colors:[{hex:'#B76E79',label:'Rose'},{hex:'#D4AF7A',label:'Gold'},{hex:'#FAF0E6',label:'Ivory'}]},
  {name:'Classic white',colors:[{hex:'#FFFFFF',label:'White'},{hex:'#C9A96E',label:'Gold'}]},
  {name:'Dusty blue',colors:[{hex:'#7BA7BC',label:'Dusty blue'},{hex:'#F5F0EB',label:'Cream'},{hex:'#FFFFFF',label:'White'}]},
  {name:'Emerald',colors:[{hex:'#2E8B57',label:'Emerald'},{hex:'#FFFFFF',label:'White'},{hex:'#D4AF7A',label:'Gold'}]},
  {name:'Burgundy',colors:[{hex:'#800020',label:'Burgundy'},{hex:'#D4AF7A',label:'Gold'},{hex:'#FFFFF0',label:'Ivory'}]},
  {name:'Lavender',colors:[{hex:'#9B7EC8',label:'Lavender'},{hex:'#FFFFFF',label:'White'},{hex:'#E8D5B7',label:'Cream'}]},
  {name:'Champagne',colors:[{hex:'#F7E7CE',label:'Champagne'},{hex:'#C9A96E',label:'Gold'},{hex:'#FFFFFF',label:'White'}]},
  {name:'Terracotta',colors:[{hex:'#E07052',label:'Terracotta'},{hex:'#D4C5B0',label:'Sand'},{hex:'#F5F0EB',label:'Cream'}]},
  {name:'Navy & gold',colors:[{hex:'#1B2A4A',label:'Navy'},{hex:'#D4AF7A',label:'Gold'},{hex:'#FFFFFF',label:'White'}]},
];
export const STYLE_OPTIONS=['Romantic','Modern / minimal','Rustic / boho','Glamorous','Garden / outdoor','Traditional','Vintage','Fiesta / colorful','Elegant / classic','Tropical','Industrial chic','Fairytale'];
