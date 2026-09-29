"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Modal, Switch, useOverlayState } from "@heroui/react";
import {
  ALL_COOKIES_ACCEPTED,
  COOKIE_PREFERENCE_CATEGORIES,
} from "@/lib/cookie-consent/config";
import type {
  CookieCategory,
  CookieCategoryPreferences,
} from "@/lib/cookie-consent/types";

type CookieSettingsModalProps = {
  open: boolean;
  initialCategories: CookieCategoryPreferences;
  onClose: () => void;
  onSave: (categories: CookieCategoryPreferences) => void;
  onRejectAll: () => void;
};

function optionalCategoryId(
  id: CookieCategory,
): id is Exclude<CookieCategory, "necessary"> {
  return id !== "necessary";
}

export function CookieSettingsModal({
  open,
  initialCategories,
  onClose,
  onSave,
  onRejectAll,
}: CookieSettingsModalProps) {
  const [categories, setCategories] = useState(initialCategories);
  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose();
    },
  });
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open) {
      state.open();
      if (!wasOpenRef.current) {
        setCategories(initialCategories);
      }
    } else {
      state.close();
    }
    wasOpenRef.current = open;
  }, [open]);

  const setOptionalCategory = (
    id: Exclude<CookieCategory, "necessary">,
    enabled: boolean,
  ) => {
    setCategories((current) => ({
      ...current,
      [id]: enabled,
    }));
  };

  if (!state.isOpen) return null;

  return (
    <Modal state={state}>
      <Modal.Backdrop isDismissable>
        <Modal.Container placement="center" scroll="inside" size="lg">
          <Modal.Dialog className="max-h-[calc(100dvh-2rem)] w-[min(100%,36rem)] overflow-hidden p-0 sm:w-full sm:max-w-xl">
            <div className="relative px-5 pt-5 pr-12 pb-1 sm:px-6 sm:pt-6">
              <Modal.CloseTrigger
                aria-label="Close cookie settings"
                className="absolute top-4 right-3 cursor-pointer text-[#64748B] hover:bg-black/5 hover:text-[#0F172A]"
              />
              <Modal.Heading className="text-lg font-bold tracking-tight text-[#0F172A] sm:text-xl">
                Cookie settings
              </Modal.Heading>
              <p className="mt-1 text-sm text-[#64748B]">
                Manage your preferences
              </p>
            </div>

            <Modal.Body className="gap-6 bg-white px-5 py-6 sm:px-6">
              <p className="text-sm leading-relaxed text-[#475569]">
                We use essential cookies to run Archive Cloud, plus optional
                preference storage for UI settings. No advertising cookies.{" "}
                <Link
                  href="/cookie-policy"
                  onClick={onClose}
                  className="cursor-pointer font-semibold text-primary underline underline-offset-2 hover:text-[#0F172A]"
                >
                  Cookie Policy
                </Link>
              </p>

              <div className="flex flex-col gap-5">
                {COOKIE_PREFERENCE_CATEGORIES.map((category) => {
                  const isAlwaysActive = category.alwaysActive === true;
                  const optionalId = optionalCategoryId(category.id)
                    ? category.id
                    : null;

                  return (
                    <div
                      key={category.id}
                      className={`rounded-xl px-4 py-4 ${
                        isAlwaysActive ? "bg-[#F5FAFF]" : "bg-[#F8FAFC]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-[#0F172A]">
                            {category.title}
                          </h3>
                          <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
                            {category.description}
                          </p>
                        </div>

                        <div className="shrink-0 pt-0.5">
                          {isAlwaysActive ? (
                            <Switch
                              isSelected
                              isDisabled
                              size="md"
                              aria-label="Strictly necessary cookies"
                            >
                              <Switch.Content>
                                <Switch.Control>
                                  <Switch.Thumb />
                                </Switch.Control>
                              </Switch.Content>
                            </Switch>
                          ) : optionalId ? (
                            <Switch
                              isSelected={categories[optionalId]}
                              size="md"
                              aria-label={`Enable ${category.title}`}
                              onChange={(value) =>
                                setOptionalCategory(optionalId, Boolean(value))
                              }
                            >
                              <Switch.Content>
                                <Switch.Control>
                                  <Switch.Thumb />
                                </Switch.Control>
                              </Switch.Content>
                            </Switch>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Modal.Body>

            <Modal.Footer className="flex flex-col gap-3 bg-white px-5 pt-2 pb-5 sm:flex-row sm:flex-wrap sm:justify-end sm:px-6 sm:pb-6">
              <Button
                variant="danger"
                className="w-full rounded-full sm:w-auto"
                onPress={onRejectAll}
              >
                Reject optional
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-full sm:w-auto"
                onPress={() => onSave(ALL_COOKIES_ACCEPTED)}
              >
                Accept all
              </Button>
              <Button
                variant="primary"
                className="w-full rounded-full sm:w-auto"
                onPress={() => onSave(categories)}
              >
                Save preferences
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
