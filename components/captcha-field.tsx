"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { Turnstile } from "@marsidev/react-turnstile"
import ReCAPTCHA from "react-google-recaptcha"
import type { CaptchaProvider } from "@/lib/captcha"

export interface CaptchaState {
  /** Whether captcha keys are configured server-side. */
  configured: boolean
  /** The current widget token, or null if not yet solved/expired. */
  token: string | null
}

export interface CaptchaFieldHandle {
  /**
   * Produce a captcha token for the current submission.
   * - Invisible providers (reCAPTCHA v2 invisible): executes the challenge
   *   and resolves with the token.
   * - Visible widgets (Turnstile): resolves with the already-solved token.
   * - Not configured: resolves null.
   */
  execute: () => Promise<string | null>
}

interface CaptchaFieldProps {
  onChange: (state: CaptchaState) => void
  className?: string
}

interface CaptchaClientConfig {
  provider: CaptchaProvider
  siteKey: string
}

const EXECUTE_TIMEOUT_MS = 30_000

/**
 * Renders the configured captcha widget (Google reCAPTCHA invisible or
 * Cloudflare Turnstile) based on Admin Settings → Security. Invisible
 * providers render nothing visible — call `ref.execute()` on submit.
 * Renders nothing when captcha is not configured.
 */
export const CaptchaField = forwardRef<CaptchaFieldHandle, CaptchaFieldProps>(
  function CaptchaField({ onChange, className }, ref) {
    const [config, setConfig] = useState<CaptchaClientConfig | null>(null)
    const [loaded, setLoaded] = useState(false)
    const stateRef = useRef<CaptchaState>({ configured: false, token: null })
    const recaptchaRef = useRef<ReCAPTCHA>(null)
    const pendingRef = useRef<((token: string | null) => void) | null>(null)

    const cbRef = useRef(onChange)
    useEffect(() => {
      cbRef.current = onChange
    }, [onChange])

    const report = (state: CaptchaState) => {
      stateRef.current = state
      cbRef.current(state)
    }

    useEffect(() => {
      let cancelled = false
      fetch("/api/captcha", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return
          const cfg =
            d &&
            d.siteKey &&
            (d.provider === "recaptcha" || d.provider === "turnstile")
              ? {
                  provider: d.provider as CaptchaProvider,
                  siteKey: String(d.siteKey),
                }
              : null
          setConfig(cfg)
          setLoaded(true)
          report({ configured: Boolean(cfg), token: null })
        })
        .catch(() => {
          if (cancelled) return
          setLoaded(true)
          report({ configured: false, token: null })
        })
      return () => {
        cancelled = true
      }
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        execute: () => {
          const current = stateRef.current
          if (!current.configured || !config) {
            return Promise.resolve(null)
          }

          // Invisible reCAPTCHA: run the challenge on demand.
          if (config.provider === "recaptcha") {
            const widget = recaptchaRef.current
            if (!widget) return Promise.resolve(null)
            return new Promise<string | null>((resolve) => {
              pendingRef.current = resolve
              const timer = setTimeout(() => {
                if (pendingRef.current === resolve) {
                  pendingRef.current = null
                  resolve(null)
                }
              }, EXECUTE_TIMEOUT_MS)
              try {
                widget.reset()
                widget.execute()
              } catch {
                clearTimeout(timer)
                pendingRef.current = null
                resolve(null)
              }
            }).then((token) => {
              report({ configured: true, token })
              return token
            })
          }

          // Visible widget (Turnstile): return the solved token.
          return Promise.resolve(current.token)
        },
      }),
      [config]
    )

    const settle = (token: string | null) => {
      pendingRef.current?.(token)
      pendingRef.current = null
      report({ configured: true, token })
    }

    if (!loaded || !config) return null

    return (
      <div className={className}>
        {config.provider === "recaptcha" ? (
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey={config.siteKey}
            size="invisible"
            onChange={(token) => settle(token)}
            onExpired={() => settle(null)}
            onErrored={() => settle(null)}
          />
        ) : (
          <Turnstile
            siteKey={config.siteKey}
            onSuccess={(token) => settle(token)}
            onExpire={() => settle(null)}
            onError={() => settle(null)}
            options={{ theme: "auto" }}
          />
        )}
      </div>
    )
  }
)
