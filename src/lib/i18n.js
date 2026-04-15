// Bilingual label map — no library needed
export const LABELS = {
  // Navigation
  dashboard:      { en: 'Dashboard',        es: 'Panel principal' },
  events:         { en: 'Events',           es: 'Eventos' },
  clients:        { en: 'Clients',          es: 'Clientes' },
  dress_rental:   { en: 'Dress Rental',     es: 'Alquiler de Vestidos' },
  alterations:    { en: 'Alterations',      es: 'Alteraciones' },
  invoices:       { en: 'Invoices',         es: 'Facturas' },
  appointments:   { en: 'Appointments',     es: 'Citas' },
  client_lookup:  { en: 'Client Lookup',    es: 'Buscar cliente' },
  settings:       { en: 'Settings',         es: 'Configuración' },
  inventory:      { en: 'Inventory',        es: 'Inventario' },
  payments:       { en: 'Payments',         es: 'Pagos' },

  // Appointment types
  consultation:   { en: 'Consultation',     es: 'Consulta' },
  fitting:        { en: 'Fitting',          es: 'Prueba de vestido' },
  pickup:         { en: 'Pickup',           es: 'Recogida' },
  return:         { en: 'Return',           es: 'Devolución' },

  // Invoice
  invoice:        { en: 'Invoice',          es: 'Factura' },
  deposit:        { en: 'Deposit',          es: 'Depósito' },
  balance:        { en: 'Balance',          es: 'Saldo' },
  send_invoice:   { en: 'Send Invoice',     es: 'Enviar Factura' },
  add_payment:    { en: 'Add Payment',      es: 'Agregar Pago' },
  create_invoice: { en: 'Create Invoice',   es: 'Crear Factura' },

  // Payment methods
  card:           { en: 'Credit / Debit Card',       es: 'Tarjeta de crédito / débito' },
  zelle:          { en: 'Zelle',                     es: 'Zelle' },
  cash:           { en: 'Cash',                      es: 'Efectivo' },

  // Actions
  save:           { en: 'Save',             es: 'Guardar' },
  cancel:         { en: 'Cancel',           es: 'Cancelar' },
  edit:           { en: 'Edit',             es: 'Editar' },
  schedule:       { en: 'Schedule',         es: 'Programar' },
  send:           { en: 'Send',             es: 'Enviar' },
  confirm:        { en: 'Confirm',          es: 'Confirmar' },
  search:         { en: 'Search',           es: 'Buscar' },
  add_client:     { en: 'Add Client',       es: 'Agregar cliente' },
  new_event:      { en: 'New Event',        es: 'Nuevo evento' },
  skip:           { en: 'Skip',             es: 'Omitir' },
  back:           { en: 'Back',             es: 'Atrás' },
  next:           { en: 'Next',             es: 'Siguiente' },
  done:           { en: 'Done',             es: 'Listo' },
  close:          { en: 'Close',            es: 'Cerrar' },

  // Status
  scheduled:      { en: 'Scheduled',        es: 'Programada' },
  completed:      { en: 'Completed',        es: 'Completada' },
  cancelled:      { en: 'Cancelled',        es: 'Cancelada' },
  no_show:        { en: 'No show',          es: 'No se presentó' },
  confirmed:      { en: 'Confirmed',        es: 'Confirmada' },
  paid:           { en: 'Paid',             es: 'Pagado' },
  overdue:        { en: 'Overdue',          es: 'Vencido' },
  pending:        { en: 'Pending',          es: 'Pendiente' },
  draft:          { en: 'Draft',            es: 'Borrador' },
  sent:           { en: 'Sent',             es: 'Enviado' },
  partially_paid: { en: 'Partially paid',   es: 'Pago parcial' },

  // Consultation steps
  greet_client:     { en: 'Greet & collect info',   es: 'Saluda y recoge información' },
  listen_connect:   { en: 'Listen & connect',        es: 'Escucha y conecta' },
  dress_tryon:      { en: 'Dress try-on',            es: 'Prueba de vestidos' },
  record_dress:     { en: 'Record chosen dress',     es: 'Registra el vestido elegido' },
  check_avail:      { en: 'Check availability',      es: 'Verifica disponibilidad' },
  create_invoice_s: { en: 'Create invoice',          es: 'Crea la factura' },
  take_deposit:     { en: 'Take deposit',            es: 'Toma el depósito' },
  record_deposit:   { en: 'Record on order form',    es: 'Registra en el formulario' },
  sched_fitting:    { en: 'Schedule fitting',        es: 'Programa la prueba' },
  sched_pickup:     { en: 'Schedule pickup',         es: 'Programa la recogida' },
  sched_return:     { en: 'Schedule return',         es: 'Programa la devolución' },
  google_review:    { en: 'Ask for Google review',   es: 'Solicita reseña de Google' },
}

/**
 * Get label object for a key
 */
export function bilabel(key) {
  const l = LABELS[key]
  if (!l) return { en: key, es: key }
  return l
}

/**
 * Get language preference — 'bilingual' (default) or 'en'
 */
export function getLangPref() {
  return localStorage.getItem('belori_lang') || 'bilingual'
}

export function setLangPref(pref) {
  localStorage.setItem('belori_lang', pref)
}

export function isBilingual() {
  return getLangPref() === 'bilingual'
}
