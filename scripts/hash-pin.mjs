import { hash } from "@node-rs/argon2";

const pin = process.argv[2];

if (!pin || !/^\d{6}$/.test(pin)) {
  console.error("Usage: node scripts/hash-pin.mjs <6-digit-pin>");
  console.error("Put the printed hash in PIN_HASH. Never commit the PIN.");
  process.exit(1);
}

console.log(await hash(pin));
