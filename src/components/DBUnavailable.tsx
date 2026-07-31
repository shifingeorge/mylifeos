/**
 * What a screen renders instead of its data when Dexie will not open —
 * almost always a version upgrade that threw on this device.
 *
 * The alternative is worse than an error: every screen opens the database
 * in an effect and sets state from it, so a failure that is not caught
 * leaves Home showing `0 / 0` and `NOTHING OPEN` and the grid showing
 * nothing at all. That is indistinguishable from a month of data being
 * gone, and a tick on top of it silently fails. Saying so plainly, and
 * saying the server copy is untouched, is the whole job here.
 */
export function DBUnavailable() {
  return (
    <div
      role="alert"
      className="px-6 py-10 text-center text-[11px] leading-loose tracking-[0.1em]"
      style={{ color: "var(--alert)" }}
    >
      LOCAL DATABASE COULD NOT BE OPENED
      <br />
      <span style={{ color: "var(--type-muted)" }}>
        NOTHING HAS BEEN LOST FROM THE SERVER
        <br />
        RELOAD TO TRY AGAIN
      </span>
    </div>
  );
}
