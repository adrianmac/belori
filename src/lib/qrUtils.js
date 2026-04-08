import QRCode from 'qrcode'

/**
 * Returns the canonical scan URL for a dress.
 * Uses the current origin so it works in dev (localhost:5173) and prod (belori.app).
 */
export function getDressQrUrl(dressId) {
  return `${window.location.origin}/scan/${dressId}`
}

/**
 * Generates a QR code as an SVG string.
 * @param {string} url — the URL to encode
 * @returns {Promise<string>} SVG markup string
 */
export async function generateQRSvg(url, size = 200) {
  return QRCode.toString(url, {
    type: 'svg',
    width: size,
    margin: 2,
    color: {
      dark: '#1C1012',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  })
}

/**
 * Generates a QR code as a data URL (PNG).
 * @param {string} url
 * @returns {Promise<string>} data:image/png;base64,...
 */
export async function generateQRDataUrl(url, size = 300) {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 2,
    color: {
      dark: '#1C1012',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  })
}
