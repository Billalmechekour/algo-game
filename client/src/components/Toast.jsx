import { useEffect } from "react";

export default function Toast({ message, type = "info", duration = 3000, onClose }) {
  const fadeOutDurationMs = 280;
  const fadeOutDelayMs = Math.max(0, duration - fadeOutDurationMs);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const bgColor = {
    error: "rgba(239, 68, 68, 0.95)",
    success: "rgba(34, 197, 94, 0.95)",
    warning: "rgba(251, 146, 60, 0.95)",
    info: "rgba(59, 130, 246, 0.95)",
  }[type] || "rgba(59, 130, 246, 0.95)";

  return (
    <div
      className="toast"
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        backgroundColor: bgColor,
        color: "white",
        padding: "16px 24px",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        fontSize: "14px",
        fontWeight: "500",
        zIndex: 9999,
        animation: `slideIn 0.3s ease-out, toastFadeOut ${fadeOutDurationMs}ms ease-in ${fadeOutDelayMs}ms forwards`,
        maxWidth: "400px",
        wordWrap: "break-word",
        whiteSpace: "pre-line",
      }}
    >
      {message}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(500px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes toastFadeOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(24px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
