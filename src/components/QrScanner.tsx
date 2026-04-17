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
  const readerId = useId().replace(/:/g, "");

  useEffect(() => {
    if (!active) return;

    let isCancelled = false;

    const cleanupScanner = async () => {
      if (!scannerRef.current) return;

      try {
        await scannerRef.current.stop();
      } catch {}

      try {
        await scannerRef.current.clear();
      } catch {}

      scannerRef.current = null;
    };

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(readerId);
        scannerRef.current = scanner;
        scannedRef.current = false;

        const cameras = await Html5Qrcode.getCameras();
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
            onScan(decodedText);

            await cleanupScanner();
          },
          () => {}
        );
      } catch (error) {
        if (!isCancelled) {
          onError?.(
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
  }, [active, onError, onScan, readerId]);

  return <div className="qr-reader" id={readerId} />;
}
