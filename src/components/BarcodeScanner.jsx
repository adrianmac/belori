import React, { useState, useEffect, useRef } from 'react'
import { C } from '../lib/colors'

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const [lastScan, setLastScan] = useState(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  // lastScan ref so the interval closure always sees the latest value
  const lastScanRef = useRef(null)

  useEffect(() => {
    startCamera()
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // wait for the video to be ready before starting detection
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(() => {})
          setScanning(true)
          startDetection()
        }
      } else {
        setScanning(true)
        startDetection()
      }
    } catch (e) {
      setError('Camera access denied. Please allow camera permissions and try again.')
    }
  }

  function startDetection() {
    if (!('BarcodeDetector' in window)) {
      setError('Barcode detection is not supported in this browser. Try Chrome 88+ or Edge 88+.')
      return
    }

    const detector = new window.BarcodeDetector({
      formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'data_matrix'],
    })

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      try {
        const barcodes = await detector.detect(video)
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue
          if (code && code !== lastScanRef.current) {
            lastScanRef.current = code
            setLastScan(code)
            onScan(code)
            // debounce: prevent re-firing same code for 2 seconds
            setTimeout(() => { lastScanRef.current = null }, 2000)
          }
        }
      } catch (_) {
        // detection errors are benign (e.g. video not ready yet)
      }
    }, 400)
  }

  function stopCamera() {
    clearInterval(intervalRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  function handleClose() {
    stopCamera()
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Viewfinder */}
      <div style={{
        position: 'relative', width: 300, height: 300,
        borderRadius: 16, overflow: 'hidden',
        border: `3px solid ${C.rosa}`,
        boxShadow: `0 0 0 4000px rgba(0,0,0,0.6)`,
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {/* Corner brackets overlay */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {/* top-left */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 24, height: 24, borderTop: `3px solid ${C.rosa}`, borderLeft: `3px solid ${C.rosa}` }}/>
          {/* top-right */}
          <div style={{ position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderTop: `3px solid ${C.rosa}`, borderRight: `3px solid ${C.rosa}` }}/>
          {/* bottom-left */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: 24, height: 24, borderBottom: `3px solid ${C.rosa}`, borderLeft: `3px solid ${C.rosa}` }}/>
          {/* bottom-right */}
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderBottom: `3px solid ${C.rosa}`, borderRight: `3px solid ${C.rosa}` }}/>
          {/* scan line */}
          {scanning && !lastScan && (
            <div style={{
              position: 'absolute', left: 12, right: 12, top: '50%',
              height: 2, background: `linear-gradient(90deg, transparent, ${C.rosa}, transparent)`,
              opacity: 0.8, animation: 'scanline 1.8s ease-in-out infinite',
            }}/>
          )}
        </div>

        {/* Success flash */}
        {lastScan && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(21, 128, 61, 0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 48 }}>✓</span>
          </div>
        )}
      </div>

      {/* CSS keyframes injected inline */}
      <style>{`
        @keyframes scanline {
          0%   { transform: translateY(-80px); opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(80px); opacity: 0; }
        }
      `}</style>

      {/* Status messages */}
      <div style={{ marginTop: 20, textAlign: 'center', maxWidth: 300, padding: '0 16px' }}>
        {error ? (
          <div style={{ color: '#FCA5A5', fontSize: 13, lineHeight: 1.5 }}>{error}</div>
        ) : lastScan ? (
          <div style={{ color: '#86EFAC', fontSize: 14, fontWeight: 600 }}>
            Scanned: {lastScan.length > 40 ? lastScan.slice(0, 40) + '…' : lastScan}
          </div>
        ) : scanning ? (
          <div style={{ color: '#9CA3AF', fontSize: 13 }}>
            Point camera at a QR code or barcode
          </div>
        ) : (
          <div style={{ color: '#9CA3AF', fontSize: 13 }}>Starting camera…</div>
        )}
      </div>

      <button
        onClick={handleClose}
        style={{
          marginTop: 24, padding: '10px 28px',
          background: 'rgba(255,255,255,0.1)', color: '#fff',
          border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10,
          fontSize: 14, cursor: 'pointer', fontWeight: 500,
        }}
      >
        Close scanner
      </button>
    </div>
  )
}
