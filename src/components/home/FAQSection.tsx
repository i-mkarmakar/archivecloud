"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { SectionBadge } from "@/components/home/SectionBadge";
import { cn } from "@/lib/utils";

const FAQ_ITEMS = [
  {
    question: "Does Archive Cloud store any of my files?",
    answer:
      "No. Archive Cloud does not store, cache, or keep copies of your files as a storage layer. Uploads and transfers go to your connected providers. Your data stays in your own cloud accounts.",
  },
  {
    question: "Can I transfer files between clouds without downloading?",
    answer:
      "Yes. Archive Cloud moves or copies files between connected accounts through the app, so you do not need to download and re-upload manually on your device.",
  },
  {
    question: "Which cloud storage services does Archive Cloud support?",
    answer:
      "Archive Cloud currently supports Google Drive, Google Photos, Google Shared Drive, OneDrive, Dropbox, pCloud, and iCloud. You can connect unlimited cloud accounts on both Free and Thunder.",
  },
  {
    question: "Is there a data transfer limit?",
    answer:
      "Yes. Free includes 50 GB of bandwidth per month. Thunder ($9 lifetime) includes unlimited monthly bandwidth, plus folder sync, real-time sync, and smart upload routing.",
  },
  {
    question: "How is Archive Cloud different from other multi-cloud tools?",
    answer:
      "Archive Cloud is open source (Apache 2.0), self-hostable, and designed so your files stay in your clouds. You can use the hosted Free plan, upgrade to Thunder for lifetime sync features, or run it on your own infrastructure.",
  },
  {
    question: "How secure is Archive Cloud for cloud-to-cloud transfers?",
    answer:
      "Providers connect with official OAuth where supported. Archive Cloud does not store your provider passwords, and your files remain in your cloud accounts rather than on Archive Cloud as permanent storage.",
  },
  {
    question: "Does Archive Cloud support real-time folder sync?",
    answer:
      "Yes, on Thunder. Folder sync and automatic real-time sync (including provider webhooks where available) are Thunder features. Free includes core hub, search, transfers, and scheduled tasks.",
  },
  {
    question: "Can I use Archive Cloud to back up files between clouds?",
    answer:
      "Yes. You can copy or sync content between connected accounts. Thunder unlocks ongoing folder sync so backups and sync jobs can keep running without babysitting every transfer.",
  },
  {
    question: "What is a Virtual Folder in Archive Cloud?",
    answer:
      "A Virtual Folder is an app-side view that groups files from different clouds in one place without moving the originals. Each provider keeps its own storage; you just organize by project, client, or topic.",
  },
  {
    question: "Can I use Archive Cloud with my team?",
    answer:
      "Archive Cloud is built primarily for individual use today. You can share files and invite others to specific files or folders. Broader team collaboration features may expand over time.",
  },
  {
    question: "Can I upgrade or change my plan anytime?",
    answer:
      "Yes. Start on Free, then upgrade to Thunder for a one-time $9 lifetime purchase when you want unlimited bandwidth and advanced sync. Self-hosting remains available if you want full control on your own server.",
  },
] as const;

const MOBILE_PREVIEW_COUNT = 5;

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      if (!mobile) setShowAll(false);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const visibleItems =
    isMobile && !showAll ? FAQ_ITEMS.slice(0, MOBILE_PREVIEW_COUNT) : FAQ_ITEMS;
  const canToggleMore = isMobile && FAQ_ITEMS.length > MOBILE_PREVIEW_COUNT;

  return (
    <section
      id="faq"
      className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16"
    >
      <div className="mx-auto max-w-[720px]">
        <div className="text-center">
          <SectionBadge>FAQ</SectionBadge>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#0F172A] sm:mt-4 sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-2 text-sm text-[#64748B] sm:mt-3 sm:text-base">
            Everything you need to know about Archive Cloud.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:mt-10 sm:gap-3">
          {visibleItems.map((item, index) => {
            const open = openIndex === index;
            const answerId = `faq-home-answer-${index}`;
            return (
              <div
                key={item.question}
                className="rounded-xl border border-[#E5EEF7] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:rounded-2xl"
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={answerId}
                  onClick={() => setOpenIndex(open ? -1 : index)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-3 text-left sm:gap-4 sm:px-5 sm:py-4"
                >
                  <span className="text-sm font-semibold leading-snug text-[#0F172A] sm:text-[15px]">
                    {item.question}
                  </span>
                  {open ? (
                    <Minus className="size-3.5 shrink-0 text-primary sm:size-4" />
                  ) : (
                    <Plus className="size-3.5 shrink-0 text-[#64748B] sm:size-4" />
                  )}
                </button>
                {open ? (
                  <div
                    id={answerId}
                    aria-live="polite"
                    className="px-3.5 pb-3 sm:px-5 sm:pb-4"
                  >
                    <p className="text-xs leading-relaxed text-[#64748B] sm:text-sm">
                      {item.answer}
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {canToggleMore ? (
          <div className="mt-4 flex justify-center sm:mt-5">
            <button
              type="button"
              onClick={() => {
                setShowAll((prev) => {
                  const next = !prev;
                  if (!next && openIndex >= MOBILE_PREVIEW_COUNT) {
                    setOpenIndex(0);
                  }
                  return next;
                });
              }}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-[#E5EEF7] bg-white px-3.5 text-xs font-semibold text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-[#BFDFFF] hover:bg-[#F5FAFF] sm:h-auto sm:px-4 sm:py-2 sm:text-sm",
              )}
            >
              {showAll ? "Show Less" : "Show More"}
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform sm:size-4",
                  showAll && "rotate-180",
                )}
              />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
