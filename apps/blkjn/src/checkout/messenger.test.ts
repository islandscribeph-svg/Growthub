import assert from "node:assert/strict";
import test from "node:test";
import { messengerPurchaseUrl } from "../data/messenger.ts";

test("purchase links use the verified Messenger page and a ref for known products", () => {
  assert.equal(messengerPurchaseUrl([]), "https://m.me/553723741160341");
  assert.equal(
    messengerPurchaseUrl([{ sku: "BLKJN-P01", quantity: 1 }]),
    "https://m.me/553723741160341?ref=BLKJN-P01-1",
  );
  assert.equal(
    messengerPurchaseUrl([
      { sku: "BLKJN-P01", quantity: 2 },
      { sku: "BLKJN-P15", quantity: 1 },
    ]),
    "https://m.me/553723741160341?ref=BLKJN-P01-2_BLKJN-P15-1",
  );
  assert.equal(messengerPurchaseUrl([{ sku: "OTHER", quantity: 1 }]), "https://m.me/553723741160341");
  const url = messengerPurchaseUrl([{ sku: "BLKJN-P07", quantity: 1 }]);
  assert.equal(url.startsWith("https://m.me/553723741160341"), true);
  assert.equal(url.includes("61573128997098"), false);
  assert.equal(url.includes("text="), false);
  assert.equal(url.includes("facebook.com"), false);
});
