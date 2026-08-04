import React, { useState, useRef, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { QrCode, CheckCircle, XCircle } from 'lucide-react'
import { scanAttendance } from '../../services/attendance.service'
import { useToast } from '../../hooks/useToast'
import { playScanBeep } from '../../utils/sound'
import { useHardwareScanner } from '../../hooks/useHardwareScanner'


export const AttendanceScanner = ({ onScanSuccess }) => {
  const [employeeId, setEmployeeId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [lastScan, setLastScan] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const cameraRef = useRef(null)
  const html5QrcodeScannerRef = useRef(null)
  const inputRef = useRef(null)
  const isMountedRef = useRef(true)
  const scanLockRef = useRef(false)
  const cooldownTimeoutRef = useRef(null)
  const lastDecodedRef = useRef({ text: null, at: 0 })
  const inputDebounceRef = useRef(null)
  const lastInputAtRef = useRef(0)

  const COOLDOWN_MS = 5000
  const INPUT_AUTOSCAN_DELAY_MS = 150
  const TERMINATOR_GUARD_MS = 500

  const { showToast } = useToast()

  const startCooldown = () => {
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current)
    }

    cooldownTimeoutRef.current = setTimeout(() => {
      scanLockRef.current = false
    }, COOLDOWN_MS)
  }

  // Auto scan with toggle (no type needed - backend determines IN/OUT)
  const handleAutoScan = async (valueOverride) => {
    if (isLoading) return

    const raw = (valueOverride ?? employeeId).trim()
    if (!raw) {
      showToast('Please scan a QR code', 'warning')
      return
    }

    if (scanLockRef.current) return
    scanLockRef.current = true

    setIsLoading(true)
    let didSucceed = false

    try {
      let cleanId = raw
      let employeeIdFromQR = null

      // Parse QR data if it's JSON
      try {
        const parsed = JSON.parse(raw)
        if (parsed.qrId) {
          cleanId = parsed.qrId
          // Only pass an employee override if it's a Mongo ObjectId.
          const candidate =
            (typeof parsed.employeeId === 'string' && parsed.employeeId) ||
            (typeof parsed.employeeId === 'object' && parsed.employeeId?._id) ||
            null
          if (typeof candidate === 'string' && /^[a-fA-F0-9]{24}$/.test(candidate)) {
            employeeIdFromQR = candidate
          }
        }
      } catch {
        // Not JSON, use raw value as-is
      }

      console.log('Auto scanning attendance for:', cleanId, 'with employeeId:', employeeIdFromQR)
      
      // Pass employeeId to backend if available
      const result = await scanAttendance(cleanId, null, employeeIdFromQR)

      setLastScan(result)
      const action = result.scanType === 'IN' ? 'IN' : 'OUT'
      showToast(`Checked ${action}`, 'success')
      setEmployeeId('')

      didSucceed = true
      playScanBeep(action)
      startCooldown()

      if (onScanSuccess) {
        onScanSuccess()
      }
    } catch (error) {
      console.error('Attendance scan error:', error)
      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Failed to scan attendance'
      showToast(errorMessage, 'error')
      setEmployeeId('') // Clear on error too
    } finally {
      setIsLoading(false)

      // Only enforce the 5s delay after a successful scan.
      if (!didSucceed) {
        scanLockRef.current = false
      }
    }
  }

  // Zebra IRD / hardware scanners commonly type the decoded value + Enter/Tab.
  // This runs in parallel with camera scanning.
  useHardwareScanner({
    enabled: true,
    // Prevent DataWedge suffix (Enter/Tab) from triggering default actions (e.g. Logout).
    preventDefaultDuringScan: true,
    maxInterKeyDelayMs: 250,
    onScan: (text) => {
      setEmployeeId(text)
      handleAutoScan(text)
    },
  })

  // Camera QR scan logic
  const startCameraScan = () => {
    console.log('Starting camera scan...')
    
    if (!cameraRef.current) {
      console.error('Camera element not ready')
      setCameraError('Camera element not ready')
      return
    }
    
    console.log('Camera element ready')
    setCameraError(null)

    // Camera APIs require secure context (HTTPS) except localhost
    if (!window.isSecureContext) {
      const host = window.location.hostname
      const isLocalhost = host === 'localhost' || host === '127.0.0.1'
      if (!isLocalhost) {
        const msg = 'Camera requires HTTPS. Open the site over HTTPS to use the scanner.'
        setCameraError(msg)
        setIsScanning(false)
        return
      }
    }

    if (!isMountedRef.current) {
      console.log('Component unmounted; aborting camera start')
      return
    }

    if (html5QrcodeScannerRef.current) {
      console.log('Stopping existing scanner')
      html5QrcodeScannerRef.current.stop().catch(() => {})
      html5QrcodeScannerRef.current = null
    }

    console.log('Creating Html5Qrcode instance')
    const qr = new Html5Qrcode('qr-reader')
    html5QrcodeScannerRef.current = qr

    console.log('Requesting camera access...')
    qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        const decoded = String(decodedText ?? '')
        const now = Date.now()

        if (scanLockRef.current) return

        // Prevent repeated triggers on the same QR while it's still in view.
        if (lastDecodedRef.current.text === decoded && now - lastDecodedRef.current.at < 2000) {
          return
        }

        lastDecodedRef.current = { text: decoded, at: now }
        console.log('QR Code detected:', decoded)

        setEmployeeId(decoded)
        handleAutoScan(decoded)
      },
      () => {
        // Scanning errors are normal (no QR in view)
      }
    )
      .then(() => {
        console.log('Camera started successfully')
        setIsScanning(true)
        setCameraError(null)
      })
      .catch((err) => {
        console.error('Camera start error:', err)
        setIsScanning(false)
        const errorMsg = err?.message || String(err)
        setCameraError(errorMsg)

        // Common cases: permission denied or browser requires a user gesture.
        if (errorMsg.includes('NotAllowedError') || errorMsg.toLowerCase().includes('permission')) {
          showToast('Camera blocked. Click "Retry Camera" and allow permissions.', 'error')
        } else if (errorMsg.includes('NotFoundError') || errorMsg.includes('NotReadableError')) {
          showToast('No camera found or camera is busy.', 'error')
        } else {
          showToast('Unable to access camera. Please check permissions.', 'error')
        }
      })
  }

  const stopCameraScan = () => {
    console.log('Stopping camera scan')
    setIsScanning(false)
    if (html5QrcodeScannerRef.current) {
      const instance = html5QrcodeScannerRef.current
      html5QrcodeScannerRef.current = null
      instance
        .stop()
        .then(() => instance.clear())
        .catch((err) => {
          console.log('Camera stop/clear error (may be already stopped):', err)
        })
    }
  }

  // Auto-start camera when component mounts
  useEffect(() => {
    console.log('AttendanceScanner mounted')
    isMountedRef.current = true
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        console.log('Starting camera after delay')
        startCameraScan()
      }
    }, 100)
    
    return () => {
      console.log('AttendanceScanner unmounting')
      isMountedRef.current = false
      clearTimeout(timer)
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current)
        cooldownTimeoutRef.current = null
      }
      if (inputDebounceRef.current) {
        clearTimeout(inputDebounceRef.current)
        inputDebounceRef.current = null
      }
      stopCameraScan()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKeyDown = (e) => {
      const isTerminator = e.key === 'Enter' || e.key === 'Tab'
      if (!isTerminator) return

      const input = inputRef.current
      if (input && document.activeElement === input) {
        e.preventDefault()
        return
      }

      const sinceLastInput = Date.now() - lastInputAtRef.current
      if (sinceLastInput >= 0 && sinceLastInput <= TERMINATOR_GUARD_MS) {
        e.preventDefault()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [])

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-200">
      <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-4 flex items-center">
        <QrCode className="w-5 h-5 mr-2 text-blue-600" />
        Attendance Scanner
      </h3>

      <div className="space-y-4">
        {/* Camera View - Always Displayed */}
        <div className="mt-2 mb-4 bg-slate-50 rounded-lg p-3 sm:p-4">
          <div
            ref={cameraRef}
            id="qr-reader"
            className="mx-auto w-full max-w-full sm:max-w-130 h-[55vh] max-h-115 min-h-65 overflow-hidden rounded-md bg-white [&_video]:w-full! [&_video]:h-full! [&_video]:object-cover [&_canvas]:w-full! [&_canvas]:h-full! [&_canvas]:object-cover **:max-w-full"
          />
          <p className="text-center text-sm text-slate-600 mt-3">
            {isLoading
              ? 'Processing...'
              : cameraError
                ? cameraError
                : isScanning
                  ? 'Camera active - Point at QR code'
                  : 'Initializing camera...'}
          </p>
          {cameraError && (
            <div className="mt-3 text-center">
              <Button
                variant="primary"
                onClick={startCameraScan}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              >
                Retry Camera
              </Button>
            </div>
          )}
        </div>

        <div>
          <Input
            ref={inputRef}
            value={employeeId}
            onChange={(e) => {
              const nextValue = e.target.value
              setEmployeeId(nextValue)
              lastInputAtRef.current = Date.now()

              if (inputDebounceRef.current) {
                clearTimeout(inputDebounceRef.current)
              }

              inputDebounceRef.current = setTimeout(() => {
                handleAutoScan(nextValue)
              }, INPUT_AUTOSCAN_DELAY_MS)
            }}
            onBlur={(e) => {
              const nextTarget = e.relatedTarget
              if (nextTarget?.closest?.('[data-focus-exempt="true"]')) {
                return
              }
              setTimeout(() => {
                const input = inputRef.current
                if (!input || input.disabled) return
                input.focus()
              }, 0)
            }}
            placeholder="Scan QR or enter Employee ID (e.g. EMP001)"
            autoFocus
            disabled={isLoading}
            inputMode="none"
          />
        </div>

        {lastScan && (
          <div
            className={`p-4 rounded-md border ${
              lastScan.scanType === 'IN'
                ? 'bg-green-50 border-green-200'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            <div className="flex items-center">
              {lastScan.scanType === 'IN' ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <XCircle className="w-5 h-5 text-amber-600 mr-2" />
              )}

              <div>
                <p className="font-medium text-slate-900">
                  Last Scan:{' '}
                  <span className="font-bold">
                    {lastScan.scanType}
                  </span>
                </p>
                <p className="text-sm text-slate-600">
                  {new Date(lastScan.scanTime).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}