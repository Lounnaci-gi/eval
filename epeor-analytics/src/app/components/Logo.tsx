"use client";

import React from "react";
import Image from "next/image";

type Variant = "login" | "sidebar" | "mobile" | "small" | "default";

interface Props {
  variant?: Variant;
  className?: string;
  alt?: string;
}

export default function Logo({ variant = "default", className = "", alt = "Logo de l'Algérienne des Eaux" }: Props) {
  let sizeCls = "h-auto w-10";
  switch (variant) {
    case "login":
      sizeCls = "h-auto w-10";
      break;
    case "sidebar":
      sizeCls = "h-auto w-8";
      break;
    case "mobile":
      sizeCls = "h-auto w-7";
      break;
    case "small":
      sizeCls = "h-auto w-6";
      break;
    default:
      sizeCls = "h-auto w-10";
  }

  return (
    <Image
      src="/logo.png"
      alt={alt}
      className={`${sizeCls} object-contain ${className}`.trim()}
      width={64}
      height={64}
      priority
      role="img"
      aria-hidden={alt ? undefined : true}
    />
  );
}
