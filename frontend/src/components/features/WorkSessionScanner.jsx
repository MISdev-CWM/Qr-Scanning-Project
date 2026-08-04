import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { QrCode, CheckCircle, XCircle } from "lucide-react";

import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { toggleProcessWorkSession } from "../../services/scan.service";
import { useToast } from "../../hooks/useToast";
import { playScanBeep } from "../../utils/sound";
import { useHardwareScanner } from "../../hooks/useHardwareScanner";

export const WorkSessionScanner = ({ onScanSuccess }) => {
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const cameraRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);
  const isMountedRef = useRef(true);
  const scanLockRef = useRef(false);
  const lastDecodedRef = useRef({ text: null, at: 0 });
  const cooldownTimeoutRef = useRef(null);

  const COOLDOWN_MS = 5000;

  const { showToast } = useToast();

  const startCooldown = () => {
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
    }

    cooldownTimeoutRef.current = setTimeout(() => {
      scanLockRef.current = false;
    }, COOLDOWN_MS);
  };

  // Auto scan with toggle (backend determines IN/OUT)
  const handleAutoScan = async (valueOverride) => {
    const raw = String(valueOverride ?? value).trim();
    if (!raw) {
      showToast("Please scan a QR code", "warning");
      return;
    }

    if (scanLockRef.current) return;
    scanLockRef.current = true;

    setIsLoading(true);
    let didSucceed = false;

    try {
      const cleanId = raw;
      console.log("Auto scanning work session for:", cleanId);

      // Don't pass scanType - let backend auto-toggle
      const result = await toggleProcessWorkSession(cleanId);

      setLastScan({
        scanType: result.scanType,
        scanTime: result.scanTime,
        processName: result.processName || result.session?.processName,
      });

      const action = result.scanType === "IN" ? "started" : "ended";
      const proc = result.processName || result.session?.processName;
      showToast(`Session ${action}${proc ? ` (${proc})` : ""}`, "success");
      setValue("");

      didSucceed = true;
      playScanBeep(result.scanType);
      startCooldown();

      if (onScanSuccess) {
        onScanSuccess();
      }
    } catch (error) {
      console.error("Work Session scan error:", error);
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to scan work session";
      showToast(errorMessage, "error");
      setValue(""); // Clear on error too
    } finally {
      setIsLoading(false);
      // Only enforce the 5s delay after a successful scan.
      if (!didSucceed) {
        scanLockRef.current = false;
      }
    }
  };

  // Zebra IRD / hardware scanners commonly type the decoded value + Enter/Tab.
  // This runs in parallel with camera scanning.
  useHardwareScanner({
    enabled: true,
    // Prevent DataWedge suffix (Enter/Tab) from triggering default actions (e.g. Logout).
    preventDefaultDuringScan: true,
    maxInterKeyDelayMs: 250,
    onScan: (text) => {
      setValue(text);
      handleAutoScan(text);
    },
  });

  const startCameraScan = () => {
    if (!cameraRef.current) {
      setCameraError("Camera element not ready");
      return;
    }

    setCameraError(null);

    // Camera APIs require secure context (HTTPS) except localhost
    if (!window.isSecureContext) {
      const host = window.location.hostname;
      const isLocalhost = host === "localhost" || host === "127.0.0.1";
      if (!isLocalhost) {
        setCameraError(
          "Camera requires HTTPS. Open the site over HTTPS to use the scanner.",
        );
        setIsScanning(false);
        return;
      }
    }

    if (!isMountedRef.current) return;

    if (html5QrcodeScannerRef.current) {
      html5QrcodeScannerRef.current.stop().catch(() => {});
      html5QrcodeScannerRef.current = null;
    }

    const qr = new Html5Qrcode("work-session-qr-reader");
    html5QrcodeScannerRef.current = qr;

    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        const decoded = String(decodedText ?? "");
        const now = Date.now();

        if (scanLockRef.current) return;

        // Prevent repeated triggers on the same QR while it's still in view.
        if (
          lastDecodedRef.current.text === decoded &&
          now - lastDecodedRef.current.at < 2000
        ) {
          return;
        }

        lastDecodedRef.current = { text: decoded, at: now };
        setValue(decoded);
        handleAutoScan(decoded);
      },
      () => {
        // Scanning errors are normal (no QR in view)
      },
    )
      .then(() => {
        setIsScanning(true);
        setCameraError(null);
      })
      .catch((err) => {
        setIsScanning(false);
        const errorMsg = err?.message || String(err);
        setCameraError(errorMsg);

        if (
          errorMsg.includes("NotAllowedError") ||
          errorMsg.toLowerCase().includes("permission")
        ) {
          showToast(
            "Camera blocked. Click “Retry Camera” and allow permissions.",
            "error",
          );
        } else if (
          errorMsg.includes("NotFoundError") ||
          errorMsg.includes("NotReadableError")
        ) {
          showToast("No camera found or camera is busy.", "error");
        } else {
          showToast(
            "Unable to access camera. Please check permissions.",
            "error",
          );
        }
      });
  };

  const stopCameraScan = () => {
    setIsScanning(false);
    if (html5QrcodeScannerRef.current) {
      const instance = html5QrcodeScannerRef.current;
      html5QrcodeScannerRef.current = null;
      instance
        .stop()
        .then(() => instance.clear())
        .catch(() => {});
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    const timer = setTimeout(() => {
      if (isMountedRef.current) startCameraScan();
    }, 100);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);

      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
        cooldownTimeoutRef.current = null;
      }

      stopCameraScan();
    };
  }, []);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-200">
      <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-4 flex items-center">
        <QrCode className="w-5 h-5 mr-2 text-blue-600" />
        Work Session Scanner
      </h3>

      <div className="space-y-4">
        {/* Camera View - Always Displayed */}
        <div className="mt-2 mb-4 bg-slate-50 rounded-lg p-3 sm:p-4">
          <div
            ref={cameraRef}
            id="work-session-qr-reader"
            className="mx-auto w-full max-w-full sm:max-w-130 h-[55vh] max-h-115 min-h-65 overflow-hidden rounded-md bg-white [&_video]:w-full! [&_video]:h-full! [&_video]:object-cover [&_canvas]:w-full! [&_canvas]:h-full! [&_canvas]:object-cover **:max-w-full"
          />

          <p className="text-center text-sm text-slate-600 mt-3">
            {isLoading
              ? "Processing..."
              : cameraError
                ? cameraError
                : isScanning
                  ? "Camera active - Point at QR code"
                  : "Initializing camera..."}
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

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Scan QR or enter Employee ID (e.g. EMP001)"
              disabled={isLoading}
            />
          </div>
          <Button
            variant="primary"
            onClick={() => handleAutoScan()}
            disabled={isLoading}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? "Processing..." : "Submit"}
          </Button>
        </div>

        {lastScan && (
          <div
            className={`p-4 rounded-md border ${
              lastScan.scanType === "IN"
                ? "bg-green-50 border-green-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <div className="flex items-center">
              {lastScan.scanType === "IN" ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <XCircle className="w-5 h-5 text-amber-600 mr-2" />
              )}
              <div>
                <p className="font-medium text-slate-900">
                  Last Scan:{" "}
                  <span className="font-bold">{lastScan.scanType}</span>
                </p>
                {lastScan.processName && (
                  <p className="text-sm text-slate-700">
                    Process:{" "}
                    <span className="font-medium">{lastScan.processName}</span>
                  </p>
                )}
                {lastScan.scanTime && (
                  <p className="text-sm text-slate-600">
                    {new Date(lastScan.scanTime).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkSessionScanner;
