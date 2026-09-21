"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { SectionBadge } from "@/components/home/SectionBadge";

const FAQ_ITEMS = [
  {
    question: "Is my data stored on Archive Cloud's servers?",
    answer:
      "Archive Cloud streams uploads directly to connected cloud providers and does not use Archive Cloud servers as your file storage layer. Your files stay in your clouds.",
  },
  {
    question: "Which cloud providers are supported?",
    answer:
      "Google Drive, Google Photos, Google Shared Drive, Dropbox, OneDrive, pCloud and iCloud.",
  },
  {
    question: "Can I use Archive Cloud for free?",
    answer: "Yes. Archive Cloud has a free plan.",
  },
  {
    question: "What is the Thunder plan?",
    answer:
      "Thunder is a $9 one-time lifetime upgrade with additional automation, synchronization, routing and transfer features.",
  },
  {
    question: "Can I self-host Archive Cloud?",
    answer:
      "Yes. Archive Cloud is open source under Apache License 2.0 and can be self-hosted.",
  },
] as const;

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);
  const openItem = openIndex >= 0 ? FAQ_ITEMS[openIndex] : null;

  return (
    <section
      id="faq"
      className="scroll-mt-24 px-4 py-12 sm:px-6 lg:px-8 lg:py-16"
    >
      <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <SectionBadge>FAQ</SectionBadge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-3 max-w-md text-base text-[#64748B]">
            Everything you need to know about Archive Cloud.
          </p>
        </div>

        <div>
          {}
          <div className="divide-y divide-[#E5EEF7] rounded-2xl border border-[#E5EEF7] bg-white">
            {FAQ_ITEMS.map((item, index) => {
              const open = openIndex === index;
              return (
                <button
                  key={item.question}
                  type="button"
                  aria-expanded={open}
                  aria-controls="faq-home-answer"
                  onClick={() => setOpenIndex(open ? -1 : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-[15px] font-semibold text-[#0F172A]">
                    {item.question}
                  </span>
                  {open ? (
                    <Minus className="size-4 shrink-0 text-[#1683F7]" />
                  ) : (
                    <Plus className="size-4 shrink-0 text-[#64748B]" />
                  )}
                </button>
              );
            })}
          </div>

          {}
          {openItem ? (
            <section
              id="faq-home-answer"
              aria-live="polite"
              className="mt-5 px-1"
            >
              <p className="text-sm font-semibold text-[#0F172A]">
                {openItem.question}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
                {openItem.answer}
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
