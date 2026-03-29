/**
 * Bidirectional sync between tab store and browser URL.
 *
 * - Tab changes → URL updates (via navigate)
 * - URL changes → active tab updates (on mount / browser back/forward)
 *
 * Does NOT create tabs from URLs — tabs come from localStorage persistence.
 * The URL only tracks which tab is active.
 */

import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTabStore } from "@/stores/tabStore";
import { tabToUrl } from "@/lib/routes";

export function useRouteSync() {
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActive = useTabStore((s) => s.setActive);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const suppressUrlUpdate = useRef(false);

  // Tab change → URL update
  useEffect(() => {
    if (suppressUrlUpdate.current) {
      suppressUrlUpdate.current = false;
      return;
    }
    if (!activeTab) return;

    const targetUrl = tabToUrl(activeTab);
    if (location.pathname !== targetUrl) {
      navigate(targetUrl, { replace: true });
    }
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Browser back/forward → find matching tab and activate it
  useEffect(() => {
    const path = location.pathname;

    // Find the tab that matches this URL
    for (const tab of tabs) {
      if (tabToUrl(tab) === path) {
        if (tab.id !== activeTabId) {
          suppressUrlUpdate.current = true;
          setActive(tab.id);
        }
        return;
      }
    }

    // If URL is "/" and dashboard tab exists, activate it
    if (path === "/" || path === "") {
      const dashboard = tabs.find((t) => t.type === "dashboard");
      if (dashboard && dashboard.id !== activeTabId) {
        suppressUrlUpdate.current = true;
        setActive(dashboard.id);
      }
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
}
