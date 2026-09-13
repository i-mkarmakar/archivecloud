"use client";

import { useEffect } from "react";

export default function FaqsRedirectPage() {
  useEffect(() => {
    window.location.replace("/#faq");
  }, []);

  return null;
}
