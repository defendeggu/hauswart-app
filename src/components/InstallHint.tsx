import { useEffect, useState } from "react";

const DISMISSED_KEY = "hauswart-app:install-hint-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

function isStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari
  return Boolean((window.navigator as { standalone?: boolean }).standalone);
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    /* Private Modus o.ä. - dann zeigt sich der Hinweis beim nächsten Mal erneut. */
  }
}

export function InstallHint() {
  const [visible, setVisible] = useState(false);
  const [androidPrompt, setAndroidPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;

    if (isIos()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setAndroidPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (!visible) return null;

  function close() {
    dismiss();
    setVisible(false);
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-teal-50 px-4 py-2 text-sm text-teal-900">
      <p>
        {iosHint
          ? "Für die Installation: Teilen-Symbol antippen, dann „Zum Home-Bildschirm“."
          : "Diese App lässt sich auf dem Startbildschirm installieren."}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {androidPrompt && (
          <button
            type="button"
            onClick={async () => {
              await androidPrompt.prompt();
              close();
            }}
            className="rounded-lg bg-teal-700 px-3 py-1.5 font-medium text-white"
          >
            Installieren
          </button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label="Hinweis schliessen"
          className="px-2 py-1.5 text-teal-700"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
