"use client";

import { createElement, useEffect } from "react";

export function LottieAnimation({
  src,
  className,
  alt = "Animation",
  loop = true,
  autoplay = true,
  speed = 1,
}: {
  src: string;
  className?: string;
  alt?: string;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
}) {
  const isImageAsset = /\.(gif|png|jpe?g|webp|svg)$/i.test(src);

  useEffect(() => {
    if (isImageAsset) return;
    void import("@dotlottie/player-component");
  }, [isImageAsset]);

  if (isImageAsset) {
    return (
      <span className={className} aria-label={alt} role="img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span className={className} aria-label={alt} role="img">
      {createElement("dotlottie-player", {
        src,
        loop,
        autoplay,
        speed,
        style: { width: "100%", height: "100%" },
      })}
    </span>
  );
}
