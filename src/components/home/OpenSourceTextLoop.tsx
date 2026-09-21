"use client";

import TextLoop from "@/components/home/TextLoop";
import { useEffect, useState } from "react";

export function OpenSourceTextLoop() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <section
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden py-3 sm:py-0"
      aria-label="Open source"
    >
      <TextLoop
        text="Open Source ✦ Self-Hostable ✦ Apache 2.0 ✦ Your Clouds Your Control"
        shape="line"
        speed={90}
        direction="forward"
        separator="✦"
        curviness={90}
        fontSize={isMobile ? 26 : 22}
        fontWeight={800}
        letterSpacing={isMobile ? 1.5 : 2}
        color="#ffffff"
        ribbon
        ribbonColor="#1e9df1"
        ribbonWidth={isMobile ? 56 : 36}
        separatorPadding={isMobile ? 1 : 1}
        pauseOnHover
        className="w-full"
      />
    </section>
  );
}
