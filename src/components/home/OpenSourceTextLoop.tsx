"use client";

import TextLoop from "@/components/home/TextLoop";

export function OpenSourceTextLoop() {
  return (
    <section
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden py-0"
      aria-label="Open source"
    >
      <TextLoop
        text="Open Source ✦ Self-Hostable ✦ Apache 2.0 ✦ Your Clouds Your Control"
        shape="line"
        speed={90}
        direction="forward"
        separator="✦"
        curviness={90}
        fontSize={22}
        fontWeight={800}
        letterSpacing={2}
        color="#ffffff"
        ribbon
        ribbonColor="#1e9df1"
        ribbonWidth={36}
        pauseOnHover
        className="w-full"
      />
    </section>
  );
}
