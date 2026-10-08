"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react"

/**
 * Minimal, dependency-free toast system for the admin portal.
 *
 * The repo has no toast library, and the admin area needs to tell users when a
 * session has expired (previously the "session expired" event was dispatched but
 * had no listener, so users were silently redirected with no explanation).
 *
 * Mounted once in the admin protected layout via <AdminToastProvider>.
 */

type ToastVariant = "info" | "success" | "warning" | "error"

interface Toast {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  /** Auto-dismiss after this many ms. 0 = sticky (must be dismissed manually). */
  duration: number
}

interface ToastContextValue {
  toast: (input: { title: string; description?: string; variant?: ToastVariant; duration?: number }) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const VARIANT_STYLES: Record<ToastVariant, { container: string; icon: ReactNode }> = {
  info: {
    container: "border-blue-200 bg-blue-50 text-blue-900",
    icon: <Info className="h-5 w-5 text-blue-600" />,
  },
  success: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
  },
  warning: {
    container: "border-amber-200 bg-amber-50 text-amber-900",
    icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
  },
  error: {
    container: "border-red-200 bg-red-50 text-red-900",
    icon: <XCircle className="h-5 w-5 text-red-600" />,
  },
}

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Clear any pending auto-dismiss timers on unmount.
  useEffect(() => {
    const map = timers.current
    return () => {
      for (const t of map.values()) clearTimeout(t)
      map.clear()
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback<ToastContextValue["toast"]>(
    ({ title, description, variant = "info", duration = 5000 }) => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      setToasts((prev) => {
        // Cap the stack so a burst of errors can't cover the screen.
        const next = [...prev, { id, title, description, variant, duration }]
        return next.slice(-4)
      })
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        )
      }
      return id
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            aria-live="polite"
            aria-atomic="true"
            className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
          >
            {toasts.map((t) => {
              const s = VARIANT_STYLES[t.variant]
              return (
                <div
                  key={t.id}
                  role="status"
                  className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-lg ${s.container}`}
                >
                  <span className="mt-0.5 shrink-0">{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{t.title}</p>
                    {t.description && <p className="mt-0.5 text-xs opacity-90">{t.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss notification"
                    className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}

/**
 * Access the toast API. Safe to call outside the provider — returns a no-op
 * fallback so components never crash if the provider is not mounted.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (ctx) return ctx
  return {
    toast: () => "",
    dismiss: () => {},
  }
}
