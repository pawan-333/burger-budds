"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Phone, ShieldCheck, X } from "lucide-react";
import { useApp } from "@/context/AppContext";

export function OtpAuthModal() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    sendPhoneOtp,
    verifyPhoneOtp,
  } = useApp();

  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [name, setName] = useState("Aditya Verma");
  const [phone, setPhone] = useState("9826055443");
  const [otp, setOtp] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isAuthModalOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
      setStep("phone");
      setErrorMsg(null);
      setInfoMsg(null);
    }
  }, [isAuthModalOpen]);

  // Fallback for browsers without <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isInDialog =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!isInDialog) {
        closeAuthModal();
      }
    };

    dialog.addEventListener("click", handleBackdropClick);
    return () => dialog.removeEventListener("click", handleBackdropClick);
  }, [closeAuthModal]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    const res = await sendPhoneOtp(phone);
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(res.message);
      return;
    }
    setInfoMsg(res.message);
    setStep("otp");
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    const res = await verifyPhoneOtp(phone, otp, name);
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(res.message);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={closeAuthModal}
      aria-labelledby="otp-modal-title"
      className="w-full max-w-md rounded-md bg-surface-base text-text-primary p-0 shadow-floating backdrop:bg-surface-dark/60 backdrop:backdrop-blur-xs"
    >
      <div className="bg-brand-secondary text-text-onSecondary px-5 py-4 flex items-center justify-between">
        <div>
          <h2 id="otp-modal-title" className="text-lg font-extrabold">
            {step === "phone" ? "Login / Sign Up" : "Verify Mobile OTP"}
          </h2>
          <p className="text-xs text-text-onSecondary/85">
            Unlock 150 BB Coins & faster checkout with Burger Budds
          </p>
        </div>
        <button
          type="button"
          onClick={closeAuthModal}
          aria-label="Close login modal"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xs text-text-onSecondary hover:bg-brand-secondaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5">
        {errorMsg && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xs bg-status-errorSoft border border-status-error text-status-error text-xs font-bold"
          >
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div
            role="status"
            className="mb-4 p-3 rounded-xs bg-status-openSoft border border-status-open text-status-open text-xs font-bold flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{infoMsg}</span>
          </div>
        )}

        {step === "phone" ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label
                htmlFor="auth-name"
                className="block text-xs font-bold text-text-secondary mb-1"
              >
                Your Name
              </label>
              <input
                id="auth-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full min-h-[44px] px-3.5 rounded-xs border border-border-muted bg-surface-base text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-secondary"
              />
            </div>

            <div>
              <label
                htmlFor="auth-phone"
                className="block text-xs font-bold text-text-secondary mb-1"
              >
                Mobile Number *
              </label>
              <div className="flex items-center rounded-xs border border-border-muted bg-surface-base focus-within:ring-2 focus-within:ring-brand-secondary overflow-hidden">
                <span className="px-3 py-2.5 bg-surface-raised text-sm font-bold text-text-secondary border-r border-border-muted flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-brand-secondary" />
                  +91
                </span>
                <input
                  id="auth-phone"
                  type="tel"
                  required
                  maxLength={10}
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="10-digit mobile number"
                  className="w-full min-h-[44px] px-3.5 text-sm font-bold text-text-primary focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || phone.length !== 10}
              className="w-full min-h-[44px] rounded-xs bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-text-onPrimary font-extrabold text-sm flex items-center justify-center gap-2 shadow-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 transition duration-fast"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending OTP...</span>
                </>
              ) : (
                <span>Send Verification OTP</span>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="auth-otp"
                  className="text-xs font-bold text-text-secondary"
                >
                  Enter 6-Digit OTP sent to +91 {phone}
                </label>
                <button
                  type="button"
                  onClick={() => setStep("phone")}
                  className="text-xs font-bold text-brand-secondary underline"
                >
                  Change Number
                </button>
              </div>
              <input
                id="auth-otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                className="w-full min-h-[44px] px-4 rounded-xs border border-border-muted bg-surface-base text-center tracking-[0.4em] text-lg font-extrabold text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-secondary"
              />
              <p className="mt-1.5 text-[11px] font-medium text-text-muted">
                Tip: Use <strong className="text-text-primary">123456</strong>{" "}
                for instant demo verification if SMS gateway is not linked.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 4}
              className="w-full min-h-[44px] rounded-xs bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-text-onPrimary font-extrabold text-sm flex items-center justify-center gap-2 shadow-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 transition duration-fast"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying OTP...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify & Continue</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
