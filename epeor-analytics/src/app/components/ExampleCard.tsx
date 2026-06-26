"use client";

import React from "react";

export default function ExampleCard({ title = "Titre", body = "Contenu de la carte" }: { title?: string; body?: string }) {
  return (
    <article
      className="page-card"
      style={{
        background: "rgb(var(--color-bg-secondary))",
        border: "1px solid rgba(var(--color-border), 0.12)",
        color: "rgb(var(--color-text-primary))",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <img src="/logo192.png" alt="logo" width={36} height={36} className="theme-adapt" style={{ borderRadius: 8 }} />
        <h3 style={{ margin: 0, fontWeight: 700 }}>{title}</h3>
      </header>

      <div style={{ color: "rgb(var(--color-text-secondary))", marginBottom: 12 }}>{body}</div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={{
            background: "transparent",
            color: "rgb(var(--color-accent))",
            border: "1px solid rgba(var(--color-accent), 0.12)",
            padding: "8px 12px",
            borderRadius: 8,
          }}
        >
          Action
        </button>
        <button
          style={{
            background: "rgb(var(--color-accent))",
            color: "rgb(var(--color-bg-secondary))",
            border: "none",
            padding: "8px 12px",
            borderRadius: 8,
          }}
        >
          Primary
        </button>
      </div>
    </article>
  );
}
