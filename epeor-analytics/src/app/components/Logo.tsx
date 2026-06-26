"use client";

import React from "react";

type Variant = "login" | "sidebar" | "mobile" | "small" | "default";

interface Props {
  variant?: Variant;
  className?: string;
  alt?: string;
}

export default function Logo({ variant = "default", className = "", alt = "EPEOR" }: Props) {
  let sizeCls = "h-8 w-8";
  switch (variant) {
    case "login":
      sizeCls = "h-10 w-10";
      break;
    case "sidebar":
      sizeCls = "w-8 h-8";
      break;
    case "mobile":
      sizeCls = "w-7 h-7";
      break;
    case "small":
      sizeCls = "w-6 h-6";
      break;
    default:
      sizeCls = "h-8 w-8";
  }

  return (
    <img
      src="/logo.png"
      alt={alt}
      className={`${sizeCls} object-contain ${className}`.trim()}
      role="img"
      aria-hidden={alt ? undefined : true}
    />
  );
}
