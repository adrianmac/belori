import React, { useState, useMemo, useEffect, useRef } from 'react';
import { C } from '../lib/colors';
import { Topbar } from '../lib/ui.jsx';

// ─── DATA ──────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'dashboard',
    emoji: '📊',
    title: 'Dashboard',
    desc: 'Your boutique at a glance — stats, upcoming events, and today\'s schedule.',
    items: [
      { title: 'Overview stats', body: 'The top row shows active events, clients this month, pending payments, and dresses currently out. These update in real time.' },
      { title: 'AI Insights panel', body: 'Belori automatically surfaces what needs your attention: overdue payments, dress returns due, low stock alerts, and upcoming deadlines — all in one panel.' },
      { title: 'Revenue Forecast', body: 'The 12-week bar chart shows upcoming milestone payments bucketed into 30, 60, and 90 day totals. Hover any bar to see the exact amount.' },
      { title: 'Today\'s appointments', body: 'See every appointment scheduled for today. Click "+ New" to add an appointment directly from the dashboard without leaving the screen.' },
      { title: 'Onboarding checklist', body: 'First-time setup? The onboarding card walks you through connecting your profile, inviting staff, creating your first event, and setting up automations.' },
    ],
  },
  {
    id: 'events',
    emoji: '📅',
    title: 'Events',
    desc: 'Manage weddings, quinceañeras, and all event types from creation to completion.',
    items: [
      { title: 'Creating an event', body: 'Click "+ New Event" to open the 5-step wizard. Fill in: (1) client name and type, (2) event date and venue, (3) guest count, (4) select a service package, (5) review and confirm. The event is saved as a draft until you confirm.' },
      { title: 'Event types', body: 'Supported event types: Wedding, Quinceañera, Baptism, Birthday, Anniversary, Graduation, Baby Shower, Bridal Shower. Each type pre-selects relevant services automatically.' },
      { title: 'Event detail', body: 'Click any event to open its full detail view. Tabs include: Milestones (payment schedule), Appointments, Tasks, Notes, Guests, Day-of checklist, and the Decoration planner for assigning inventory items.' },
      { title: 'Event status flow', body: 'Events move through: Draft → Confirmed → Completed. Update the status from the event detail topbar. Completed events are excluded from the active events count.' },
      { title: 'Duplicating an event', body: 'Click the 📋 copy icon on any event card to clone it. The clone is saved as a draft with the same services, package, and venue — edit the date and client before confirming.' },
      { title: 'Downloading a contract PDF', body: 'Open the event detail → click "Contract" in the topbar. Belori generates a branded PDF with event details, services, and payment schedule.' },
      { title: 'Inspiration board', body: 'In the event detail, the Inspiration tab lets you record the client\'s color palette, style themes, floral preferences, and notes. These appear on the contract PDF.' },
      { title: 'Decoration planner', body: 'The Decoration tab shows all inventory items assigned to this event. Click "+ Add Item" to search your inventory and assign quantity. Items are reserved automatically.' },
    ],
  },
  {
    id: 'clients',
    emoji: '👤',
    title: 'Clients',
    desc: 'Full CRM — client profiles, interactions, measurements, and pipeline management.',
    items: [
      { title: 'Adding a client', body: 'From the Clients page, click "+ New Client". Fill in name, phone, email, and optionally partner name, language preference, and referral source.' },
      { title: 'Overview tab', body: 'Shows measurements, dress recommendations, loyalty points, birthday, anniversary, emergency contact, and communication preferences.' },
      { title: 'Measurements tracker', body: 'In the Overview tab, click "+ Take Measurements" to record bust, waist, hips, and height. Belori calculates the suggested US dress size automatically based on the measurements.' },
      { title: 'Timeline tab', body: 'A unified chronological feed of all interactions: SMS messages, appointments, payments, alteration updates, and manual notes — all grouped by date.' },
      { title: 'Events tab', body: 'See every event linked to this client. Click any event to jump directly to its detail view.' },
      { title: 'Pipeline tab', body: 'Track this client\'s lead stage: Leads → Contacted → Proposal → Booked → Completed. Add an estimated event date, value, and source for reporting.' },
      { title: 'Tags & Prefs tab', body: 'Add custom tags to categorize clients (e.g., VIP, referral, social media lead). Tags are color-coded and searchable across the client list.' },
      { title: 'Birthday & anniversary reminders', body: 'Add a birth_date and anniversary_date in the client edit form. Belori will automatically send an SMS on those days (configurable in Settings → Automations).' },
      { title: 'Loyalty points', body: 'Points are awarded on each logged interaction. Click "Adjust Points" to manually add or deduct. Click "Redeem" when the client uses their points.' },
      { title: 'Merging clients', body: 'If a client appears twice, use the "Merge" button in the client detail to combine them. All interactions, events, and payments transfer to the primary record.' },
    ],
  },
  {
    id: 'sms',
    emoji: '💌',
    title: 'SMS & Messaging',
    desc: 'Two-way SMS conversations with clients, powered by Twilio.',
    items: [
      { title: 'SMS Inbox', body: 'Access via Sidebar → SMS Inbox. The two-panel layout shows all client conversations on the left; click any conversation to open the full message thread on the right.' },
      { title: 'Sending a message', body: 'Open a client conversation → type your message in the input at the bottom → press Enter or click Send. Messages are delivered via Twilio SMS.' },
      { title: 'WhatsApp', body: 'WhatsApp is supported via Twilio. When enabled by your administrator, messages can be sent over WhatsApp instead of SMS for clients who prefer it.' },
      { title: 'Inbound confirmations', body: 'Clients can reply YES or CONFIRM to confirm appointments, or NO or CANCEL to cancel. Belori automatically updates the appointment status and logs it to the client timeline.' },
      { title: 'Automated reminders', body: 'SMS reminders fire automatically: 24h before an appointment (daily 9am), 2h before (hourly check), 3 days before a payment is due, and at 1, 7, and 14 days overdue. Configure these in Settings → Automations.' },
      { title: 'Message templates', body: 'Pre-written message templates are available when logging payment reminders. Copy the SMS template and send it directly from the Payments page.' },
    ],
  },
  {
    id: 'rentals',
    emoji: '👗',
    title: 'Dress Rentals',
    desc: 'Track dresses from catalog to pickup, return, and cleaning.',
    items: [
      { title: 'Catalog tab', body: 'All dresses in your inventory with status badges: available (green), rented (amber), cleaning (blue), damaged (red). Filter by category, color, or size.' },
      { title: 'Active Rentals tab', body: 'Dresses currently checked out. Shows client name, event date, and days remaining. Click "📋 History" on any item to see its full rental audit trail.' },
      { title: 'Returns tab', body: 'Dresses due back, sorted by urgency. Overdue returns are highlighted in red. Click "Mark Returned" after the client brings the dress back.' },
      { title: 'Scan to Return', body: 'Click "📷 Scan to Return" to open the camera barcode scanner. Point it at the SKU barcode on the dress tag — Belori looks up the item automatically and marks it returned.' },
      { title: 'History tab', body: 'Complete history of all past rentals: who rented what, when it went out, when it came back, and its condition on return.' },
      { title: 'Creating a rental', body: 'Open a dress from the Catalog, click "Rent", select the client and event, set the pickup and return dates, then confirm. The dress status changes to reserved.' },
    ],
  },
  {
    id: 'inventory',
    emoji: '📦',
    title: 'Inventory',
    desc: 'Full inventory management for decorations, equipment, and all boutique items.',
    items: [
      { title: 'Adding items', body: 'Click "+ Add Item" and fill in: SKU, name, category, color, size, price, and deposit. For rentable items set Track to "rental". For consumables set Track to "consumable" and enter restock thresholds.' },
      { title: 'Valid categories', body: 'bridal_gown, quince_gown, arch, centerpiece, linen, lighting, chair, veil, headpiece, jewelry, ceremony, consumable, equipment. The category is enforced by the database — choose carefully.' },
      { title: 'Status tracking', body: 'Inventory items flow through: available → reserved → picked_up → returned → cleaning → damaged. Status changes are logged automatically in the Audit Log.' },
      { title: 'Views', body: 'Toggle between Grid view (cards), List view (table), and Category view (grouped by type). Use the search bar and filter dropdowns to narrow results.' },
      { title: 'Quantity tracking', body: 'For items you own multiple of, set totalQty when adding the item. Belori tracks availQty, reservedQty, outQty, and dmgQty automatically as items are checked in and out.' },
      { title: 'Audit Log tab', body: 'Every status change is recorded with staff name, timestamp, and before/after values. Access the boutique-wide log from Inventory → Audit Log tab, or per-item via the History button.' },
      { title: 'Low stock alerts', body: 'Set minStock and restockPoint when adding a consumable. Belori shows a badge on the Inventory nav item and an alert in the Dashboard when stock falls below the threshold.' },
    ],
  },
  {
    id: 'alterations',
    emoji: '✂️',
    title: 'Alterations',
    desc: 'Kanban job board for tracking every alteration from intake to delivery.',
    items: [
      { title: 'Kanban columns', body: 'Jobs move left to right: Pending → In Progress → Ready → Delivered. Drag and drop cards between columns to update status.' },
      { title: 'Adding a job', body: 'Click "+ New Job". Select the client, garment description, assigned seamstress, deadline date, and price. Optionally link the job to an event.' },
      { title: 'Work items', body: 'Within each job, add individual tasks (e.g., "Hem dress 2 inches", "Take in waist"). Check them off as the seamstress completes each step.' },
      { title: 'Deadline urgency', body: 'Jobs with deadlines within 3 days are highlighted in amber. Overdue jobs appear in red. These also surface in the Dashboard Insights panel.' },
      { title: 'Time tracking', body: 'Log time entries on any job to track hours spent. These roll up to job-level totals, useful for calculating seamstress productivity.' },
    ],
  },
  {
    id: 'payments',
    emoji: '💳',
    title: 'Payments',
    desc: 'Milestone billing, reminders, and Stripe payment links for every event.',
    items: [
      { title: 'Milestone billing', body: 'Each event has a payment schedule (e.g., 50% deposit, 50% balance). Milestones are created when setting up the event or added later from the Payments page.' },
      { title: 'Mark paid', body: 'Click the ✓ checkmark button on any milestone row. A confirmation records the paid date and updates the event\'s paid/total progress bar.' },
      { title: 'Payment reminders', body: 'Click the bell icon on a milestone → a pre-written SMS template is copied to your clipboard. The reminder is also logged to the client\'s timeline automatically.' },
      { title: 'Stripe payment links', body: 'Click "🔗 Link" on any milestone to generate a Stripe payment link. Share the link via SMS or email — clients pay online and the milestone is marked paid automatically.' },
      { title: 'Automated reminders', body: 'Belori auto-sends SMS reminders 3 days before a due date and follows up at 1, 7, and 14 days overdue. Toggle each automation in Settings → Automations.' },
      { title: 'Refunds', body: 'Log a refund from the event detail. Refunds are tracked separately and shown in the payment summary so your revenue numbers stay accurate.' },
    ],
  },
  {
    id: 'tasks',
    emoji: '📋',
    title: 'My Tasks',
    desc: 'Your personal task queue across all events and clients.',
    items: [
      { title: 'What appears here', body: 'All tasks assigned to you from both event task lists and client task lists appear in one unified view, sorted by urgency.' },
      { title: 'Sort order', body: 'Tasks are sorted: Overdue first (red) → Due today (amber) → Due this week (yellow) → Undated (gray).' },
      { title: 'Filter tabs', body: 'Use the tabs to filter: All | Event Tasks | Client Tasks | Overdue | Done. The Overdue tab shows only tasks past their due date.' },
      { title: 'Marking done', body: 'Click the checkbox on any task to mark it complete. Belori records your name and a timestamp automatically.' },
      { title: 'Alert tasks', body: 'Tasks marked as "Alert" appear with a red badge in the Events nav item. These are high-priority items that need immediate attention.' },
    ],
  },
  {
    id: 'vendors',
    emoji: '🏪',
    title: 'Vendors',
    desc: 'A contact rolodex for all your trusted vendors and partners.',
    items: [
      { title: 'Adding a vendor', body: 'Click "+ Add Vendor" in the topbar. Enter the business name, category, contact name, phone, email, website, and any notes.' },
      { title: 'Categories', body: 'Supported vendor categories: florist, photographer, DJ, catering, videographer, hair & makeup, venue, other.' },
      { title: 'Star ratings', body: 'Rate vendors 1–5 stars based on your experience. Ratings help you quickly identify your preferred partners when planning events.' },
      { title: 'Quick contact', body: 'Phone numbers and emails are clickable — tap to call or open your email client directly from the vendor card.' },
    ],
  },
  {
    id: 'expenses',
    emoji: '💰',
    title: 'Expenses',
    desc: 'Track boutique spending and see profit margins per event.',
    items: [
      { title: 'Logging an expense', body: 'Click "+ Add Expense" and fill in: amount, category, date, description. Optionally link the expense to a specific event for profit tracking.' },
      { title: 'Expense categories', body: 'Categories: supplies, marketing, staff, rent, utilities, flowers, alterations, equipment, other.' },
      { title: 'By Event tab', body: 'Shows a table of all events with their total revenue, total expenses, and calculated profit margin. Identify which events were most and least profitable.' },
      { title: 'By Category tab', body: 'A horizontal bar chart breaks down your spending by category for the selected month or date range.' },
    ],
  },
  {
    id: 'commissions',
    emoji: '💸',
    title: 'Commissions',
    desc: 'Track staff commission earnings and disbursements.',
    items: [
      { title: 'Logging a commission', body: 'On each event, log which staff member closed the sale and their commission rate. Belori calculates the dollar amount from the event total.' },
      { title: 'Default rates', body: 'Expand the "Staff Rate Settings" panel on the Commissions page to set a default commission percentage per staff member. New events will pre-fill with their rate.' },
      { title: 'Marking paid', body: 'Once you\'ve disbursed a commission payment, click "Mark Paid" on the row. The disbursement date is recorded.' },
      { title: 'Monthly totals', body: 'The header cards show total commissions earned, total paid out, and the top earner for the current month.' },
    ],
  },
  {
    id: 'promo',
    emoji: '🏷️',
    title: 'Promo Codes',
    desc: 'Create discount codes and apply them to events.',
    items: [
      { title: 'Creating a code', body: 'Click "+ New Code". Set: the code string (e.g., SAVE20), discount type (percentage or fixed amount), value, max uses, and optional expiry date.' },
      { title: 'Applying to an event', body: 'On any promo code card, click "Apply to Event" and select the event. The discount is deducted from the event total automatically.' },
      { title: 'Usage history', body: 'Expand any code card to see a full list of which events the code was applied to and when.' },
      { title: 'Expiry enforcement', body: 'Codes past their expiry date cannot be applied. Expired codes are shown with a gray badge.' },
    ],
  },
  {
    id: 'quotes',
    emoji: '📄',
    title: 'Quotes',
    desc: 'Build branded proposals to send to prospective clients.',
    items: [
      { title: '5-step builder', body: 'Step 1: Event details (type, date, venue). Step 2: Line items (services + prices). Step 3: Payment schedule. Step 4: Custom notes and terms. Step 5: Live preview.' },
      { title: 'Live preview', body: 'The right panel updates in real time as you fill in each step — see exactly what the client will receive before generating the PDF.' },
      { title: 'Generate PDF', body: 'Click "Generate PDF" on the preview step. A branded proposal document is created and downloaded to your device.' },
      { title: 'Send via SMS', body: 'After generating, click "Send via SMS" to open a pre-filled SMS with the PDF link. The message is sent through your connected Twilio number.' },
      { title: 'From an existing event', body: 'When creating a quote, you can pull in details from an existing event — services, dates, and client info are pre-filled automatically.' },
    ],
  },
  {
    id: 'funnel',
    emoji: '📊',
    title: 'Sales Funnel',
    desc: 'Visualize your lead pipeline and spot conversion drop-offs.',
    items: [
      { title: 'Funnel stages', body: 'Leads flow through: Leads → Contacted → Proposal Sent → Booked → Completed. The visual funnel shows how many leads are at each stage.' },
      { title: 'Conversion rates', body: 'Each stage shows the percentage of leads that progressed from the previous stage. A low Proposal → Booked rate may indicate pricing or follow-up issues.' },
      { title: 'Drop-off insight', body: 'Belori automatically highlights the stage with the largest drop-off in a callout card, so you know where to focus your sales efforts.' },
      { title: 'Source breakdown', body: 'The source breakdown chart shows conversion rates per lead origin: Instagram, referral, walk-in, Google, website, etc.' },
    ],
  },
  {
    id: 'guests',
    emoji: '👥',
    title: 'Guest List',
    desc: 'RSVP tracking and meal preferences for each event.',
    items: [
      { title: 'Where to find it', body: 'Open any event detail → click the "Guests" tab.' },
      { title: 'Adding guests', body: 'Click "+ Add Guest". Enter name, contact info, and meal preference. Guests can also be imported in bulk via CSV.' },
      { title: 'RSVP status', body: 'Click any RSVP badge to cycle through: Invited → Confirmed → Declined → Maybe. The count updates at the top of the tab.' },
      { title: 'Meal preferences', body: 'Options: chicken, fish, vegetarian, vegan, kids. Useful for sharing a count with your catering vendor.' },
      { title: 'Bulk actions', body: 'Select multiple guests using the checkboxes → use the bulk action bar to mark all as confirmed, declined, or to delete.' },
      { title: 'Export CSV', body: 'Click "Export CSV" to download the full guest list as a spreadsheet. Includes name, RSVP status, meal preference, and contact info.' },
    ],
  },
  {
    id: 'gallery',
    emoji: '📸',
    title: 'Photo Gallery',
    desc: 'Store and organize event photos in Supabase Storage.',
    items: [
      { title: 'Uploading photos', body: 'Open an event → Photo Gallery tab. Drag and drop photos onto the upload zone, or click to browse. Multiple files can be uploaded at once.' },
      { title: 'Photo types', body: 'Tag photos with a type: before, during, after, fitting, inspiration. Use these to filter the gallery view.' },
      { title: 'Lightbox', body: 'Click any thumbnail to open the full-size lightbox. Use arrow keys to navigate between photos.' },
      { title: 'Secure storage', body: 'Photos are stored in Supabase Storage, scoped to your boutique. Clients cannot access your internal photos.' },
    ],
  },
  {
    id: 'reviews',
    emoji: '⭐',
    title: 'Reviews',
    desc: 'Manage and respond to client reviews across platforms.',
    items: [
      { title: 'Logging reviews', body: 'Add reviews from Google, Facebook, Yelp, or other platforms. Record the source, rating (1–5 stars), reviewer name, and review text.' },
      { title: 'Rating dashboard', body: 'The header cards show your average rating, total reviews, and a rating distribution chart (1-star through 5-star counts).' },
      { title: 'Platform breakdown', body: 'See how your ratings compare across platforms with a breakdown chart.' },
      { title: 'Sending review requests', body: 'Click "Send Review Request" on any client to open a pre-filled SMS or email with your Google review link. Belori also auto-sends a review request 24h after an event completes (configurable).' },
      { title: 'Logging responses', body: 'For each review, log your reply text. This keeps a record of your reputation management activity.' },
    ],
  },
  {
    id: 'calendar',
    emoji: '📆',
    title: 'Calendar',
    desc: 'Monthly and daily views of all boutique appointments.',
    items: [
      { title: 'Views', body: 'Toggle between Monthly view (full calendar grid) and Day view (hourly schedule). Click any date in month view to jump to its day view.' },
      { title: 'Adding an appointment', body: 'Click any day in the calendar → "+ New Appointment". Fill in type, time, staff, client, and a note. The appointment is linked to the selected event if navigating from an event.' },
      { title: 'Google Calendar sync', body: 'Click "📅 Subscribe" in the topbar to get a webcal:// URL. Add this to Google Calendar, Apple Calendar, or Outlook for a read-only live sync of your boutique\'s appointments.' },
      { title: 'Mark no-show', body: 'On past appointments, click "Mark no-show". This increments the client\'s no-show counter and logs it to their timeline.' },
      { title: 'Staff Calendar', body: 'The Staff Calendar view (sidebar → Staff Calendar) shows appointments color-coded by staff member — useful for scheduling and avoiding conflicts.' },
    ],
  },
  {
    id: 'search',
    emoji: '🔍',
    title: 'Global Search (⌘K)',
    desc: 'Instantly find anything across your boutique data.',
    items: [
      { title: 'Opening search', body: 'Press Cmd+K on Mac or Ctrl+K on Windows from anywhere in the app. The search overlay opens instantly.' },
      { title: 'What it searches', body: 'Simultaneously searches clients (by name, phone, email), events (by venue, client, type), inventory (by SKU, name), and upcoming appointments.' },
      { title: 'Keyboard navigation', body: 'Use the Up/Down arrow keys to move through results. Press Enter to open the highlighted result. Press Esc to close without navigating.' },
      { title: 'Recent searches', body: 'Your last 5 searches are saved and shown when you open the search overlay with an empty query. Click any recent search to rerun it.' },
    ],
  },
  {
    id: 'notifications',
    emoji: '🔔',
    title: 'Push Notifications',
    desc: 'Get browser notifications even when Belori is in the background.',
    items: [
      { title: 'Enabling notifications', body: 'Go to Settings → Profile → toggle "Enable push notifications". Your browser will ask for permission — click Allow.' },
      { title: 'What triggers a notification', body: 'Overdue payments, appointment reminders (24h and 2h before), and inbound SMS messages from clients.' },
      { title: 'Background delivery', body: 'Notifications are delivered even when the Belori tab is minimized or the browser is in the background.' },
      { title: 'Administrator setup', body: 'Push notifications require VAPID keys to be configured by your Belori administrator. Contact support if notifications are not working.' },
    ],
  },
  {
    id: 'pwa',
    emoji: '📱',
    title: 'Install as App (PWA)',
    desc: 'Install Belori on your desktop or phone for a native-like experience.',
    items: [
      { title: 'Chrome (desktop)', body: 'Look for the install icon (a computer with a down arrow) in the address bar on the right side. Click it → "Install". Belori opens in its own window.' },
      { title: 'iOS Safari', body: 'Tap the Share button (square with arrow) → scroll down and tap "Add to Home Screen" → tap "Add". Belori appears on your home screen like a native app.' },
      { title: 'Android Chrome', body: 'A banner may appear automatically prompting you to install. Alternatively, tap the 3-dot menu → "Add to Home screen".' },
      { title: 'Offline access', body: 'Once installed, recently viewed data is available offline. You can browse client profiles, event details, and inventory while disconnected — changes sync when you reconnect.' },
    ],
  },
  {
    id: 'settings',
    emoji: '⚙️',
    title: 'Settings',
    desc: 'Configure your boutique profile, staff, automations, and billing.',
    items: [
      { title: 'Profile tab', body: 'Update your boutique name, phone, email, address, Instagram handle, and booking URL. Changes save immediately. You can also set your preferred currency symbol and language here.' },
      { title: 'Staff tab', body: 'Invite staff by entering their email address — they receive a secure invite link. Set their role: Owner, Coordinator, Front Desk, Seamstress, or Decorator. Each role has different permissions.' },
      { title: 'Automations tab', body: 'Toggle each of the 11 automated SMS/email workflows on or off. Changes apply immediately. All automations are ON by default when you create your boutique.' },
      { title: 'Templates tab', body: 'Manage reusable task templates, event checklists, email message templates, and contract templates — all in one place.' },
      { title: 'Packages tab', body: 'Create, edit, and archive service packages (e.g., "Premium Wedding Package"). Set included services, base price, and the event type it applies to.' },
      { title: 'Modules tab', body: 'Enable or disable feature modules based on your plan and business needs. Some modules require a higher plan — an upgrade prompt appears if needed.' },
      { title: 'Billing tab', body: 'View your current plan (Starter, Growth, or Pro), see usage stats, and upgrade or manage your subscription through the Stripe billing portal.' },
      { title: 'Display tab', body: 'Toggle between Desktop mode (full sidebar) and Tablet mode (icon rail) to optimize the layout for your screen size and workflow.' },
    ],
  },
  {
    id: 'import',
    emoji: '📥',
    title: 'Bulk Import',
    desc: 'Import clients, inventory, or events from a CSV file.',
    items: [
      { title: 'Accessing import', body: 'Navigate to Sidebar → Import (near the bottom). You can also find it in Settings.' },
      { title: 'Step 1: Download template', body: 'Choose your import type (Clients, Inventory, or Events) and download the template CSV. The template shows you the exact column names and formats required.' },
      { title: 'Step 2: Fill in your data', body: 'Open the template in Excel or Google Sheets. Fill in your data row by row. Do not change the column headers.' },
      { title: 'Step 3: Upload and validate', body: 'Upload your completed CSV. Belori validates every row and highlights errors in red. Fix issues before proceeding.' },
      { title: 'Step 4: Confirm import', body: 'Review the validated rows and click "Import". Records are created in batches of 50. A summary shows how many were created and how many were skipped due to errors.' },
    ],
  },
  {
    id: 'portal',
    emoji: '🔗',
    title: 'Client Portal',
    desc: 'Share a read-only event view with your client — no login required.',
    items: [
      { title: 'What the client sees', body: 'The portal shows: event date and countdown, payment milestones with a progress bar, upcoming appointments, dress rental status, and a downloadable contract.' },
      { title: 'Generating the link', body: 'Open the event detail → click "Share" or "Copy Portal Link" in the topbar. The URL is unique to that event.' },
      { title: 'No login required', body: 'Clients do not need a Belori account. The link is shareable via SMS, WhatsApp, or email.' },
      { title: 'Contract download', body: 'Clients can view and download their event contract directly from the portal page.' },
    ],
  },
  {
    id: 'audit',
    emoji: '📊',
    title: 'Inventory Audit Log',
    desc: 'Full history of every status change on every inventory item.',
    items: [
      { title: 'Automatic logging', body: 'Every time an inventory item\'s status changes (reserved, picked up, returned, cleaned, marked damaged), the change is automatically logged — no manual entry needed.' },
      { title: 'Per-item history', body: 'Open any item in the Inventory page → click "📋 History". A timeline shows every status change with staff name and timestamp.' },
      { title: 'Boutique-wide log', body: 'Go to Inventory → Audit Log tab for a chronological feed of all status changes across your entire inventory.' },
      { title: 'What\'s logged', body: 'Each log entry records: item name, SKU, previous status, new status, staff member who made the change, and the exact timestamp.' },
    ],
  },
];

const QUICK_TIPS = [
  { icon: '💡', text: 'Use ⌘K anywhere to instantly search clients and events without leaving your current screen.' },
  { icon: '💡', text: 'Clients can confirm appointments by replying YES to your automated SMS reminders — no manual update needed.' },
  { icon: '💡', text: 'The client portal lets clients see their payment status and download their contract without logging in.' },
  { icon: '💡', text: 'Set default commission rates per staff member in the Commissions page to save time on every new event.' },
];

// ─── COMPONENT ─────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [tocOpen, setTocOpen] = useState(false);
  const contentRef = useRef(null);
  const sectionRefs = useRef({});

  // Filter sections by search query
  const filtered = useMemo(() => {
    if (!query.trim()) return SECTIONS;
    const q = query.toLowerCase();
    return SECTIONS.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q) ||
      s.items.some(it => it.title.toLowerCase().includes(q) || it.body.toLowerCase().includes(q))
    );
  }, [query]);

  // Scroll spy — track which section is in view
  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveId(entry.target.dataset.sectionId);
        });
      },
      { root: contentRef.current, rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [filtered]);

  const scrollTo = (id) => {
    const el = sectionRefs.current[id];
    if (el && contentRef.current) {
      contentRef.current.scrollTo({ top: el.offsetTop - 20, behavior: 'smooth' });
      setTocOpen(false);
    }
  };

  // ─── styles ────────────────────────────────────────────────────────────
  const pageWrap = {
    flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    background: C.ivory,
  };
  const body = {
    flex: 1, display: 'flex', overflow: 'hidden', position: 'relative',
  };
  const tocStyle = {
    width: 220, flexShrink: 0,
    background: C.white, borderRight: `1px solid ${C.border}`,
    display: 'flex', flexDirection: 'column',
    overflowY: 'auto', padding: '16px 0',
  };
  const tocItemStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 16px', cursor: 'pointer', fontSize: 13,
    color: active ? C.rosaText : C.inkLight,
    background: active ? C.rosaPale : 'transparent',
    fontWeight: active ? 500 : 400,
    borderRight: active ? `2px solid ${C.rosa}` : '2px solid transparent',
    transition: 'all 0.12s',
  });
  const contentArea = {
    flex: 1, overflowY: 'auto', padding: '28px 32px',
  };
  const sectionCard = {
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
  };
  const sectionHeader = {
    padding: '18px 22px 14px',
    borderBottom: `1px solid ${C.border}`,
    background: C.blush,
  };
  const itemRow = {
    padding: '14px 22px',
    borderBottom: `1px solid ${C.border}`,
    display: 'flex', flexDirection: 'column', gap: 4,
  };
  const itemRowLast = {
    ...itemRow, borderBottom: 'none',
  };

  return (
    <div style={pageWrap}>
      <Topbar
        title="Help & Support"
        subtitle="Everything you need to know about Belori"
      />

      {/* Search bar */}
      <div style={{
        padding: '12px 20px',
        background: C.white,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{ position: 'relative', maxWidth: 520 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gray}
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search help topics…"
            style={{
              width: '100%', padding: '9px 12px 9px 36px',
              borderRadius: 8, border: `1px solid ${C.border}`,
              fontSize: 13, color: C.ink, outline: 'none',
              background: C.ivory, boxSizing: 'border-box',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.gray, fontSize: 16, lineHeight: 1, padding: '0 2px',
            }}>×</button>
          )}
        </div>
        {/* Mobile TOC toggle */}
        <button
          onClick={() => setTocOpen(o => !o)}
          style={{
            marginTop: 8, display: 'none', // shown via media query via className trick below
            alignItems: 'center', gap: 6,
            background: C.ivory, border: `1px solid ${C.border}`,
            borderRadius: 7, padding: '7px 12px',
            fontSize: 12, color: C.inkLight, cursor: 'pointer',
          }}
          className="help-mobile-toc-btn"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="10" y2="12"/>
          </svg>
          {tocOpen ? 'Hide contents' : 'Show contents'}
        </button>
      </div>

      {/* Mobile TOC dropdown */}
      {tocOpen && (
        <div style={{
          background: C.white, borderBottom: `1px solid ${C.border}`,
          padding: '8px 0', flexShrink: 0, maxHeight: 280, overflowY: 'auto',
        }}>
          {filtered.map(s => (
            <div key={s.id} onClick={() => scrollTo(s.id)} style={{
              padding: '8px 20px', cursor: 'pointer', fontSize: 13,
              color: activeId === s.id ? C.rosaText : C.inkLight,
              background: activeId === s.id ? C.rosaPale : 'transparent',
            }}>
              <span style={{ marginRight: 8 }}>{s.emoji}</span>{s.title}
            </div>
          ))}
        </div>
      )}

      <div style={body}>
        {/* Desktop TOC */}
        <div style={tocStyle} className="help-toc-desktop">
          <div style={{ padding: '0 16px 8px', fontSize: 11, fontWeight: 500, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Contents
          </div>
          {filtered.map(s => (
            <div
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={tocItemStyle(activeId === s.id)}
              onMouseEnter={e => { if (activeId !== s.id) e.currentTarget.style.background = C.ivory; }}
              onMouseLeave={e => { if (activeId !== s.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 14 }}>{s.emoji}</span>
              <span>{s.title}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div ref={contentRef} style={contentArea}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.gray }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 500, color: C.ink, marginBottom: 6 }}>No results for "{query}"</div>
              <div style={{ fontSize: 13 }}>Try different keywords or browse the sections in the sidebar.</div>
            </div>
          ) : (
            <>
              {filtered.map((section, si) => (
                <div
                  key={section.id}
                  ref={el => { sectionRefs.current[section.id] = el; }}
                  data-section-id={section.id}
                  style={sectionCard}
                >
                  {/* Section header */}
                  <div style={sectionHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 22 }}>{section.emoji}</span>
                      <span style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>{section.title}</span>
                    </div>
                    <div style={{ fontSize: 13, color: C.inkLight, lineHeight: 1.5, paddingLeft: 32 }}>
                      {section.desc}
                    </div>
                  </div>

                  {/* Items */}
                  {section.items.map((item, idx) => (
                    <div key={idx} style={idx === section.items.length - 1 ? itemRowLast : itemRow}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: C.rosaPale, color: C.rosaText,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 600, flexShrink: 0, marginTop: 1,
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 3 }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: 13, color: C.inkLight, lineHeight: 1.6 }}>
                            {item.body}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Quick Tips */}
              {!query && (
                <>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginTop: 8, marginBottom: 14 }}>
                    Quick tips
                  </div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 12, marginBottom: 28,
                  }}>
                    {QUICK_TIPS.map((tip, i) => (
                      <div key={i} style={{
                        background: C.white, border: `1px solid ${C.border}`,
                        borderRadius: 10, padding: '14px 16px',
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                      }}>
                        <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.4 }}>{tip.icon}</span>
                        <span style={{ fontSize: 13, color: C.inkLight, lineHeight: 1.6 }}>{tip.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Need more help */}
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 14 }}>
                    Need more help?
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 40 }}>
                    {/* Email support */}
                    <a href="mailto:support@belori.app" style={{ textDecoration: 'none' }}>
                      <div style={{
                        background: C.white, border: `1px solid ${C.border}`,
                        borderRadius: 10, padding: '18px 20px',
                        display: 'flex', flexDirection: 'column', gap: 6,
                        cursor: 'pointer', transition: 'border-color 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = C.rosa}
                        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 20 }}>✉️</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>Email support</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>
                          We respond within one business day. Send us a detailed description and we'll help you out.
                        </div>
                        <div style={{ fontSize: 12, color: C.rosaText, fontWeight: 500 }}>support@belori.app →</div>
                      </div>
                    </a>

                    {/* Website */}
                    <a href="https://belori.app" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                      <div style={{
                        background: C.white, border: `1px solid ${C.border}`,
                        borderRadius: 10, padding: '18px 20px',
                        display: 'flex', flexDirection: 'column', gap: 6,
                        cursor: 'pointer', transition: 'border-color 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = C.rosa}
                        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 20 }}>🌐</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>Belori website</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>
                          Visit our website for release notes, feature announcements, and tutorials.
                        </div>
                        <div style={{ fontSize: 12, color: C.rosaText, fontWeight: 500 }}>belori.app →</div>
                      </div>
                    </a>

                    {/* Feature request */}
                    <a href="mailto:feedback@belori.app?subject=Feature%20request" style={{ textDecoration: 'none' }}>
                      <div style={{
                        background: C.white, border: `1px solid ${C.border}`,
                        borderRadius: 10, padding: '18px 20px',
                        display: 'flex', flexDirection: 'column', gap: 6,
                        cursor: 'pointer', transition: 'border-color 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = C.rosa}
                        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 20 }}>💬</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>Feature request</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>
                          Have an idea that would make Belori better? We read every request.
                        </div>
                        <div style={{ fontSize: 12, color: C.rosaText, fontWeight: 500 }}>Send feedback →</div>
                      </div>
                    </a>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Responsive style injection */}
      <style>{`
        @media (max-width: 768px) {
          .help-toc-desktop { display: none !important; }
          .help-mobile-toc-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .help-mobile-toc-btn { display: none !important; }
        }
      `}</style>
    </div>
  );
}
