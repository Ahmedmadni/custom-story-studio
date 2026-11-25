import { useEffect, useState } from "react";
import { Download } from "lucide-react";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    const offer = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const installed = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!prompt) return null;
  return (
    <button
      type="button"
      className="studio-install"
      onClick={() => {
        void prompt
          .prompt()
          .then(() => prompt.userChoice)
          .catch(() => undefined)
          .finally(() => setPrompt(null));
      }}
    >
      <Download size={18} /> ثبّت كيدزي
    </button>
  );
}
