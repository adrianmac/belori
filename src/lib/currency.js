export function getCurrency() {
  return {
    code: localStorage.getItem('belori_currency') || 'USD',
    symbol: localStorage.getItem('belori_currency_symbol') || '$'
  }
}

export function fmtCurrency(amount) {
  const { symbol } = getCurrency()
  if (!amount && amount !== 0) return `${symbol}0`
  return `${symbol}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
