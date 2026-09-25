import type { ReadonlyURLSearchParams } from "next/navigation";
import { type Dispatch, type SetStateAction, useEffect } from "react";
import {
  SIDEBAR_CREATE_EVENT,
  type SidebarCreateAction,
} from "@/components/dashboard/SidebarNewButton";
import { defaultFolderColor } from "@/components/drive/folder-colors";

export function useAllFilesSidebarActions(args: {
  sp: ReadonlyURLSearchParams | URLSearchParams;
  router: { replace: (href: string) => void };
  setUploadOpen: Dispatch<SetStateAction<boolean>>;
  openNewFolderModal: () => void;
  setFolderName: Dispatch<SetStateAction<string>>;
  setFolderColor: Dispatch<SetStateAction<string>>;
  setFolderOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    sp,
    router,
    setUploadOpen,
    openNewFolderModal,
    setFolderName,
    setFolderColor,
    setFolderOpen,
  } = args;

  function runSidebarCreateAction(action: SidebarCreateAction) {
    if (action === "upload") {
      setUploadOpen(true);
      return;
    }
    openNewFolderModal();
  }

  useEffect(() => {
    const action = sp.get("action");
    if (action === "upload" || action === "new-folder") {
      const params = new URLSearchParams(sp.toString());
      params.delete("action");
      const qs = params.toString();
      router.replace(qs ? `/home?${qs}` : "/home");
      runSidebarCreateAction(action);
    }
  }, [sp, router]);

  useEffect(() => {
    function onSidebarCreate(event: Event) {
      const action = (event as CustomEvent<{ action: SidebarCreateAction }>)
        .detail?.action;
      if (action === "upload") {
        setUploadOpen(true);
      } else if (action === "new-folder") {
        setFolderName("New Folder");
        setFolderColor(defaultFolderColor);
        setFolderOpen(true);
      }
    }
    window.addEventListener(SIDEBAR_CREATE_EVENT, onSidebarCreate);
    return () =>
      window.removeEventListener(SIDEBAR_CREATE_EVENT, onSidebarCreate);
  }, []);
}
