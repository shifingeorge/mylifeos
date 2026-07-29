"use client";

import { useState } from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
const PIN_LENGTH = 6;

/**
 * Its own keypad rather than the OS keyboard: fewer taps, no layout shift,
 * and the keys land in the thumb zone.
 */
export function PinPad({
  onSubmit,
  disabled = false,
}: {
  onSubmit: (pin: string) => void;
  disabled?: boolean;
}) {
  const [pin, setPin] = useState("");

  function press(digit: string) {
    if (disabled) return;
    navigator.vibrate?.(8);

    const next = pin + digit;
    if (next.length === PIN_LENGTH) {
      setPin("");
      onSubmit(next);
      return;
    }
    setPin(next);
  }

  function back() {
    navigator.vibrate?.(8);
    setPin((p) => p.slice(0, -1));
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex gap-3" aria-label={`${pin.length} of 6 digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="text-base leading-none"
            style={{ color: i < pin.length ? "var(--accent)" : "var(--rule)" }}
          >
            ■
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => (k === "⌫" ? back() : press(k))}
              aria-label={k === "⌫" ? "Delete" : k}
              style={{ minWidth: "64px", minHeight: "56px" }}
              className="text-[15px] disabled:opacity-40
                         focus-visible:outline focus-visible:outline-2
                         focus-visible:outline-offset-[-2px]
                         focus-visible:outline-[var(--accent)]"
            >
              {k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
