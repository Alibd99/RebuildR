import { useEffect, useId, useRef } from "react";
import type { Html5Qrcode as Html5QrcodeInstance } from "html5-qrcode";

type Props = {
  active?: boolean;
  onScan: (text: string) => void;
  onError?: (message: string) => void;
};

export default function QrScanner({
  active = true,
  onScan,
  onError,
}: Props) {
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const scannedRef = useRef(false);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  const readerId = useId().replace(/:/g, "");

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!active) return;

    let isCancelled = false;

    const clearReaderElement = () => {
      document.getElementById(readerId)?.replaceChildren();
    };

    const cleanupScanner = async () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (scanner) {
        try {
          await scanner.stop();
        } catch {}

        try {
          await scanner.clear();
        } catch {}
      }

      clearReaderElement();
    };

    const startScanner = async () => {
      try {
        await cleanupScanner();
        clearReaderElement();

        const { Html5Qrcode } = await import("html5-qrcode");
        if (isCancelled) return;

        const scanner = new Html5Qrcode(readerId);
        scannerRef.current = scanner;
        scannedRef.current = false;

        const cameras = await Html5Qrcode.getCameras();
        if (isCancelled) {
          await cleanupScanner();
          return;
        }

        const preferredCamera =
          cameras.find((camera) =>
            camera.label.toLowerCase().includes("back")
          ) ?? cameras[0];

        const cameraConfig = preferredCamera?.id
          ? { deviceId: { exact: preferredCamera.id } }
          : { facingMode: "environment" };

        await scanner.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
          },
          async (decodedText) => {
            if (isCancelled || scannedRef.current) return;

            scannedRef.current = true;
            onScanRef.current(decodedText);

            await cleanupScanner();
          },
          () => {}
        );

        if (isCancelled) {
          await cleanupScanner();
        }
      } catch (error) {
        if (!isCancelled) {
          onErrorRef.current?.(
            "Kameran kunde inte starta. Kontrollera behörighet eller testa att ladda om sidan."
          );
        }
      }
    };

    void startScanner();

    return () => {
      isCancelled = true;
      void cleanupScanner();
    };
  }, [active, readerId]);

  return <div className="qr-reader" id={readerId} />;
}
