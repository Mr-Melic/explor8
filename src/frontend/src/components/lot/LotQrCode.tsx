import { lotDeepLink } from "@/hooks/use-deep-link";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";

interface LotQrCodeProps {
  lotId: string;
  className?: string;
}

/**
 * The deep link for a lot, rendered as a QR code.
 *
 * The payload is the app's own public URL plus `?lot=<id>` — nothing else. No
 * principal, no hash, no secret ever enters the code, so a photograph of the
 * screen reveals only what the public register already shows.
 */
export function LotQrCode({ lotId, className }: LotQrCodeProps) {
  const link = lotDeepLink(lotId);

  return (
    <figure className={cn("flex flex-col items-center gap-3", className)}>
      <div
        className="border border-border bg-popover p-3"
        data-ocid="lot.qr_code"
      >
        <QRCodeSVG
          value={link}
          size={148}
          level="M"
          marginSize={0}
          bgColor="transparent"
          fgColor="currentColor"
          className="size-36 text-foreground sm:size-40"
          title={`Deep link to lot ${lotId}`}
        />
      </div>
      <figcaption className="w-full max-w-[16rem] text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Scan to open this block
        </span>
        <span className="hash mt-1.5 block break-all text-xs">{link}</span>
      </figcaption>
    </figure>
  );
}
