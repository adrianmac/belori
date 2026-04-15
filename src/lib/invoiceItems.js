export const INVOICE_ITEMS = [
  // Rentals
  { id: 'dress_rental',      name: 'Dress Rental',              name_es: 'Alquiler de Vestido',              category: 'rental',    hasCustomPrice: true },
  { id: 'tuxedo_rental',     name: 'Tuxedo Rental',             name_es: 'Alquiler de Esmoquin',             category: 'rental',    hasCustomPrice: true },

  // Purchases
  { id: 'quince_dress',      name: 'Quinceañera Dress',         name_es: 'Vestido de Quinceañera',           category: 'purchase',  hasCustomPrice: true },
  { id: 'wedding_dress',     name: 'Wedding Dress',             name_es: 'Vestido de Novia',                 category: 'purchase',  hasCustomPrice: true },
  { id: 'mob_dress',         name: 'Mother of Bride Dress',     name_es: 'Vestido de Madre de Novia',        category: 'purchase',  hasCustomPrice: true },
  { id: 'bridesmaid_dress',  name: 'Bridesmaid Dress',          name_es: 'Vestido de Dama de Honor',         category: 'purchase',  hasCustomPrice: true },
  { id: 'court_dress',       name: 'Court Dress',               name_es: 'Vestido de Corte de Honor',        category: 'purchase',  hasCustomPrice: true },
  { id: 'prom_dress',        name: 'Prom Dress',                name_es: 'Vestido de Graduación',            category: 'purchase',  hasCustomPrice: true },
  { id: 'evening_dress',     name: 'Evening Dress',             name_es: 'Vestido de Noche',                 category: 'purchase',  hasCustomPrice: true },

  // Alterations
  { id: 'alteration',        name: 'Alteration',                name_es: 'Alteración',                       category: 'alteration', hasCustomPrice: true },

  // Accessories
  { id: 'crown_veil',        name: 'Crown / Veil',              name_es: 'Corona / Velo',                    category: 'accessory', hasCustomPrice: true },
  { id: 'bouquet_fresh',     name: 'Fresh Bouquet',             name_es: 'Ramo Natural',                     category: 'accessory', hasCustomPrice: true },
  { id: 'bouquet_silk',      name: 'Silk Bouquet',              name_es: 'Ramo de Seda',                     category: 'accessory', hasCustomPrice: true },
  { id: 'custom_sneakers',   name: 'Custom Sneakers',           name_es: 'Tenis Personalizados',             category: 'accessory', hasCustomPrice: true },

  // Events
  { id: 'event_decor',       name: 'Event Design / Décor',      name_es: 'Diseño de Evento / Decoración',    category: 'event',    hasCustomPrice: true },
  { id: 'photo_booth',       name: 'Photo Booth',               name_es: 'Fotomatón',                        category: 'event',    hasCustomPrice: true },
  { id: 'day_of_coord',      name: 'Day-of Coordinating',       name_es: 'Coordinación el día del evento',   category: 'event',    hasCustomPrice: true },

  // Escape hatch
  { id: 'custom',            name: 'Custom Amount',             name_es: 'Monto personalizado',              category: 'custom',   hasCustomPrice: true, isCustom: true },
]

export const ITEM_CATEGORIES = [
  { id: 'all',        label: 'All',         labelEs: 'Todos' },
  { id: 'rental',     label: 'Rentals',     labelEs: 'Alquileres' },
  { id: 'purchase',   label: 'Purchases',   labelEs: 'Compras' },
  { id: 'alteration', label: 'Alterations', labelEs: 'Alteraciones' },
  { id: 'accessory',  label: 'Accessories', labelEs: 'Accesorios' },
  { id: 'event',      label: 'Events',      labelEs: 'Eventos' },
  { id: 'custom',     label: 'Custom',      labelEs: 'Personalizado' },
]

export const RENTAL_ITEM_IDS = ['dress_rental', 'tuxedo_rental']

export const CREDIT_CARD_FEE_PCT = 0.03
export const CREDIT_CARD_FEE_LABEL = 'Credit card processing fee (3%)'
export const CREDIT_CARD_FEE_LABEL_ES = 'Cargo por tarjeta de crédito (3%)'

/** Convert dollar string to cents integer */
export function dollarsToCents(val) {
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : Math.round(n * 100)
}

/** Convert cents integer to dollar string */
export function centsToDollars(cents) {
  return (cents / 100).toFixed(2)
}

/** Format cents as currency string like "$1,200.00" */
export function fmtCents(cents) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
