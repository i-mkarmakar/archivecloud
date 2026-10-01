"use client";

import { motion } from "motion/react";

import { CloudShader } from "@/components/ui/cloud-shader";

/** Visual-only panel: shader sky + wing. No marketing chrome. */
export default function CloudShaderFlightHeroDemo() {
  return (
    <div className="relative h-full min-h-[40rem] w-full overflow-hidden bg-linear-to-t from-[#8cbfe8] to-[#3876ba]">
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      >
        <div className="absolute h-1/2 w-1/2 origin-top-left scale-200">
          <CloudShader speed={1} className="absolute inset-0" />
        </div>
      </motion.div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 bg-black/20"
      />

      <motion.div
        className="pointer-events-none absolute -bottom-6 left-0 z-10 w-[95%] md:w-[85%]"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        <img
          src="https://assets.aceternity.com/components/plane-wing.png"
          alt=""
          aria-hidden
          className="h-auto w-full object-cover"
        />
      </motion.div>
    </div>
  );
}
