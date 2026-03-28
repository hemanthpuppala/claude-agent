import { useEffect, useRef } from "react";

export function BottomSheet({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.5)",
          animation: "fadeIn 0.2s ease-out",
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 201,
          maxHeight: "85dvh",
          background: "var(--color-bg-elevated)",
          borderRadius: "16px 16px 0 0",
          border: "1px solid var(--color-border)",
          borderBottom: "none",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
          display: "flex", flexDirection: "column",
          animation: "slideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Drag handle */}
        <div style={{
          display: "flex", justifyContent: "center", padding: "10px 0 4px",
          cursor: "grab",
        }}>
          <div style={{
            width: 36, height: 4, borderRadius: 99,
            background: "var(--color-text-tertiary)", opacity: 0.4,
          }} />
        </div>

        {/* Header */}
        {title && (
          <div style={{
            padding: "4px 20px 12px",
            fontSize: 15, fontWeight: 700, color: "var(--color-text)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}>
            {title}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain" }}>
          {children}
        </div>
      </div>
    </>
  );
}
