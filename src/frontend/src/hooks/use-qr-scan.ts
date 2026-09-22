import { parseLotIdFromScan } from "@/hooks/use-deep-link";
import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";

export type ScanStatus = "idle" | "starting" | "scanning" | "error";

interface UseQrScanOptions {
  /** Called with the parsed lot id once a register QR code is read. */
  onLotId: (lotId: string) => void;
}

/**
 * Read a lot id from the device camera.
 *
 * The camera stream is opened only while scanning and always released on stop
 * or unmount, so the indicator light never stays on. Frames are sampled on an
 * interval rather than every animation frame — a QR code does not move, and
 * this keeps the main thread free for the ledger UI.
 */
export function useQrScan({ onLotId }: UseQrScanOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("starting");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setStatus("error");
      setError("This device does not expose a camera to the browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stop();
        return;
      }
      video.srcObject = stream;
      await video.play();
      setStatus("scanning");

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });

      timerRef.current = window.setInterval(() => {
        const element = videoRef.current;
        if (!element || !context || element.readyState < 2) return;
        const width = element.videoWidth;
        const height = element.videoHeight;
        if (!width || !height) return;

        canvas.width = width;
        canvas.height = height;
        context.drawImage(element, 0, 0, width, height);
        const frame = context.getImageData(0, 0, width, height);
        const result = jsQR(frame.data, frame.width, frame.height, {
          inversionAttempts: "dontInvert",
        });
        if (!result?.data) return;

        const lotId = parseLotIdFromScan(result.data);
        if (!lotId) return;
        onLotId(lotId);
        stop();
      }, 320);
    } catch {
      setStatus("error");
      setError(
        "Camera access was refused. Allow the camera, or open the lot from its link instead.",
      );
    }
  }, [onLotId, stop]);

  useEffect(() => stop, [stop]);

  return { videoRef, status, error, start, stop };
}
