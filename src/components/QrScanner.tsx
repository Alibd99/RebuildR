import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

type Props = {
  onScan: (text: string) => void;
};

export default function QrScanner({ onScan }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasStartedRef = useRef(false);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const elementId = "qr-reader";
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = "";

    const scanner = new Html5Qrcode(elementId);
    scannerRef.current = scanner;
    scannedRef.current = false;

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
          },
          async (decodedText) => {
            if (scannedRef.current) return;
            scannedRef.current = true;

            onScan(decodedText);

            try {
              await scanner.stop();
            } catch {}

            try {
              await scanner.clear();
            } catch {}
          },
          () => {}
        );
      } catch (error) {
        console.error("Scanner kunde inte starta", error);
      }
    };

    startScanner();

    return () => {
      const cleanup = async () => {
        try {
          if (scannerRef.current) {
            try {
              await scannerRef.current.stop();
            } catch {}

            try {
              await scannerRef.current.clear();
            } catch {}
          }
        } finally {
          scannerRef.current = null;
          hasStartedRef.current = false;
          const node = document.getElementById(elementId);
          if (node) node.innerHTML = "";
        }
      };

      cleanup();
    };
  }, [onScan]);

  return <div id="qr-reader" />;
}