"use client";

import TextLoop from "@/components/home/TextLoop";

export function OpenSourceTextLoop() {
  return (
    <section
      className="relative z-10 -mt-px w-full overflow-x-hidden leading-none"
      aria-label="Open source"
    >
      <TextLoop
        text="Open Source ✦ Self-Hostable ✦ Apache 2.0 ✦ Your Clouds Your Control"
        shape="line"
        speed={90}
        direction="forward"
        separator="✦"
        curviness={90}
        fontSize={20}
        fontWeight={800}
        letterSpacing={2}
        color="#ffffff"
        ribbon
        ribbonColor="#1e9df1"
        ribbonWidth={40}
        separatorPadding={1}
        pauseOnHover
        className="w-full"
      />
    </section>
  );
}
