import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showText?: boolean;
};

export function BrandLogo({
  className,
  markClassName,
  textClassName,
  showText = true,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl shadow-[0_16px_34px_-24px_var(--primary)]",
          markClassName,
        )}
      >
        <Image
          src="/edupulse-logo.svg"
          alt=""
          width={44}
          height={44}
          className="size-full"
        />
      </span>
      {showText && (
        <span className={cn("whitespace-nowrap font-semibold", textClassName)}>
          EduPulse
        </span>
      )}
    </span>
  );
}
