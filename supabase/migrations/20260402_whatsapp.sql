alter table boutiques add column if not exists whatsapp_number text;
alter table boutiques add column if not exists whatsapp_template text default 'Hi {{name}}, this is {{boutique}}. How can we help you today?';
