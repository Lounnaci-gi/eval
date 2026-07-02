"use client";

import { useEffect } from "react";
import Swal from "sweetalert2";

export function SweetAlertBridge() {
  useEffect(() => {
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;

    window.alert = ((message?: string | Error) => {
      void Swal.fire({
        title: "Information",
        text: message instanceof Error ? message.message : String(message ?? ""),
        icon: "info",
        confirmButtonText: "OK",
        confirmButtonColor: "#0D83DE",
      });
      return undefined as never;
    }) as typeof window.alert;

    window.confirm = ((message?: string) => {
      const popup = Swal.fire({
        title: "Confirmation",
        text: message ?? "",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Oui",
        cancelButtonText: "Annuler",
        confirmButtonColor: "#0D83DE",
        cancelButtonColor: "#98A2B3",
      });
      return popup.then((result) => result.isConfirmed) as unknown as boolean;
    }) as unknown as typeof window.confirm;

    return () => {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
    };
  }, []);

  return null;
}
