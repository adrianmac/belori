// ─── BRAND COLORS ──────────────────────────────────────────────────────────
export const C = {
  rosa:'#C9697A', rosaHov:'#B85868', rosaLight:'#E8B4BB', rosaPale:'#FDF5F6',
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
export const SVC_LABELS = {dress_rental:'Dress rental',alterations:'Alterations',planning:'Event planning',decoration:'Decoration',photography:'Photography',dj:'DJ / Music'};
export const SVC_COLORS = {
  dress_rental:{bg:'var(--bg-success)',text:'var(--color-success)'},
  alterations:{bg:'var(--bg-info)',text:'var(--color-info)'},
  planning:{bg:'var(--bg-accent)',text:'var(--color-accent)'},
  decoration:{bg:'var(--bg-warning)',text:'var(--color-warning)'},
  photography:{bg:'#FFF7ED',text:'#C2410C'},
  dj:{bg:'#F5F3FF',text:'#5B21B6'},
};
export const EVT_TYPES = {
  wedding:      {label:'Wedding',        bg:C.rosaPale,  col:C.rosa,    icon:'💍'},
  quince:       {label:'Quinceañera',    bg:'var(--bg-accent)',  col:'var(--color-accent)',  icon:'👑'},
  baptism:      {label:'Baptism',        bg:'var(--bg-info)',    col:'var(--color-info)',    icon:'🕊️'},
  birthday:     {label:'Birthday',       bg:'var(--bg-warning)',   col:'var(--color-warning)',   icon:'🎂'},
  anniversary:  {label:'Anniversary',    bg:C.rosaPale,  col:C.rosa,    icon:'💕'},
  graduation:   {label:'Graduation',     bg:'var(--bg-success)',   col:'var(--color-success)',   icon:'🎓'},
  baby_shower:  {label:'Baby Shower',    bg:'#E0F2FE',   col:'#0369A1', icon:'🍼'},
  bridal_shower:{label:'Bridal Shower',  bg:'#FDF2F8',   col:'#9D174D', icon:'💐'},
};
// Services available and pre-selected per event type
export const TYPE_SVCS = {
  wedding:      ['dress_rental','alterations','decoration','photography','dj'],
  quince:       ['dress_rental','alterations','decoration','photography','dj'],
  bridal_shower:['dress_rental','alterations','decoration','photography'],
  baptism:      ['decoration','photography'],
  birthday:     ['decoration','photography','dj'],
  anniversary:  ['decoration','photography'],
  graduation:   ['decoration','photography','dj'],
  baby_shower:  ['decoration','photography'],
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
