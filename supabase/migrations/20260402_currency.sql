alter table boutiques add column if not exists currency text default 'USD' check (currency in ('USD','MXN','CAD','EUR','GBP'));
alter table boutiques add column if not exists currency_symbol text default '$';
