import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchMe, getStoredAccount, getToken, HOME_BY_ROLE, isRole, logout, type Account, type Role } from "@/lib/api";

/**
 * Stran dovoli samo prijavljenemu računu z vlogo `role`.
 * Neprijavljen -> /auth, druga vloga -> domača stran te vloge.
 * Vrne račun, ko je preverjen (do takrat null).
 */
export function useRoleGuard(role: Role): Account | null {
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    if (!getToken()) {
      navigate({ to: "/auth" });
      return;
    }
    const allow = (me: Account) => {
      if (me.role === role) setAccount(me);
      else if (isRole(me.role)) navigate({ to: HOME_BY_ROLE[me.role] });
      else { logout(); navigate({ to: "/auth" }); }
    };
    const stored = getStoredAccount();
    if (stored) { allow(stored); return; }
    fetchMe().then(allow).catch(() => { logout(); navigate({ to: "/auth" }); });
  }, [navigate, role]);

  return account;
}
