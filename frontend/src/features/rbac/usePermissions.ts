import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@store/authStore";
import { getMyPermissions } from "./api";

export function usePermissions() {
  const organizationId = useAuthStore((state) => state.currentOrganization?.id);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    setPermissions(null);
    setIsAdmin(false);

    if (!organizationId) return;

    const controller = new AbortController();
    abortRef.current = controller;

    getMyPermissions()
      .then((data) => {
        if (!controller.signal.aborted) {
          setPermissions(data.permissions);
          setIsAdmin(data.is_admin);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPermissions([]);
        }
      });

    return () => {
      controller.abort();
    };
  }, [organizationId]);

  return {
    isLoading: permissions === null,
    isAdmin,
    hasPermission: useCallback(
      (permission: string) => permissions?.includes(permission) ?? false,
      [permissions],
    ),
  };
}
