import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseExtraction } from "./extraction.ts";
import {
  downloadGrantKeys,
  duplicateRejectedKeys,
  fixtureReceiptSha256,
  fulfillmentHeldKeys,
  fulfillmentRequestedKeys,
  hasKeys,
  orderLineKeys,
  outboxEventKeys,
  receiptHashMatches,
  receiptSha256,
  receiptSubmittedKeys,
  requestReceivedKeys,
} from "./make-contract.ts";
import { duplicateReferenceMessage } from "./messages.ts";
import { signBody, verifySignature } from "./signature.ts";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "../../docs/make-fixtures.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  fixtureSecret: string;
  replayWindowMs: number;
  vectors: { name: string; method: string; path: string; timestamp: string; rawBody: string; signature: string; curl: string }[];
  examples: {
    outboxList: { ok: true; events: { payload: { lines: unknown[] } }[] };
    duplicateRejected: { orderRef: string; subject: string; body: string };
    requestReceived: unknown;
    fulfillmentHeld: { reason: string };
    fulfillmentRequested: { grants: unknown[] };
    claimResponse: { event: unknown };
    auditAck: { paymentDecisionChanged: boolean };
    auditRetry: { retry: boolean; paymentDecisionChanged: boolean };
    requestSendAck: { emailSentByBackend: boolean; resent: boolean };
    deliveryReport: { resent: boolean };
    receiptObject: { sha256: string; bytesBase64: string };
  };
};

test("published HMAC vectors match the runtime signer and replay window", () => {
  assert.equal(fixture.fixtureSecret, "test-signing-secret");
  assert.equal(fixture.replayWindowMs, 5 * 60_000);
  for (const vector of fixture.vectors) {
    assert.equal(signBody(fixture.fixtureSecret, vector.timestamp, vector.rawBody), vector.signature);
    assert.equal(vector.curl.includes(vector.signature), true);
    assert.equal(vector.curl.includes("blkjn.example"), true);
    assert.equal(verifySignature({
      secret: fixture.fixtureSecret,
      timestamp: vector.timestamp,
      body: vector.rawBody,
      signature: vector.signature,
      nowMs: Date.parse(vector.timestamp),
    }), true);
    assert.equal(verifySignature({
      secret: fixture.fixtureSecret,
      timestamp: vector.timestamp,
      body: vector.rawBody,
      signature: vector.signature,
      nowMs: Date.parse(vector.timestamp) + fixture.replayWindowMs + 1,
    }), false);
    if (vector.rawBody !== "") JSON.parse(vector.rawBody);
  }
  const getOutbox = fixture.vectors.find((vector) => vector.name === "getOutbox");
  assert.equal(getOutbox?.rawBody, "");
});

test("published extraction and outbox examples match the runtime allowlist", () => {
  const extractionVector = fixture.vectors.find((vector) => vector.name === "postExtraction");
  assert.ok(extractionVector);
  const parsed = JSON.parse(extractionVector.rawBody) as { extraction: unknown };
  const extraction = parseExtraction(parsed.extraction);
  assert.equal(extraction.ok, true);
  assert.equal(parseExtraction({}).ok, false);
  const event = fixture.examples.outboxList.events[0];
  assert.equal(hasKeys(event, outboxEventKeys), true);
  assert.equal(hasKeys(event.payload, receiptSubmittedKeys), true);
  assert.equal(hasKeys(event.payload.lines[0], orderLineKeys), true);
  assert.equal(hasKeys(fixture.examples.duplicateRejected, duplicateRejectedKeys), true);
  const polite = duplicateReferenceMessage(fixture.examples.duplicateRejected.orderRef);
  assert.equal(fixture.examples.duplicateRejected.subject, polite.subject);
  assert.equal(fixture.examples.duplicateRejected.body, polite.body);
  assert.equal(hasKeys(fixture.examples.requestReceived, requestReceivedKeys), true);
  assert.equal(hasKeys(fixture.examples.fulfillmentHeld, fulfillmentHeldKeys), true);
  assert.equal(fixture.examples.fulfillmentHeld.reason, "fulfillment_disabled");
  assert.equal(hasKeys(fixture.examples.fulfillmentRequested, fulfillmentRequestedKeys), true);
  assert.equal(hasKeys(fixture.examples.fulfillmentRequested.grants[0], downloadGrantKeys), true);
  assert.equal(hasKeys(fixture.examples.claimResponse.event, outboxEventKeys), true);
  assert.equal(fixture.examples.auditAck.paymentDecisionChanged, false);
  assert.equal(fixture.examples.auditRetry.paymentDecisionChanged, false);
  assert.equal(fixture.examples.auditRetry.retry, true);
  assert.equal(fixture.examples.requestSendAck.emailSentByBackend, false);
  assert.equal(fixture.examples.requestSendAck.resent, false);
  assert.equal(fixture.examples.deliveryReport.resent, false);
  const receiptBytes = Buffer.from(fixture.examples.receiptObject.bytesBase64, "base64");
  assert.equal(receiptSha256(receiptBytes), fixtureReceiptSha256);
  assert.equal(fixture.examples.receiptObject.sha256, fixtureReceiptSha256);
  assert.equal(fixture.examples.outboxList.events[0].payload.contentSha256, fixtureReceiptSha256);
  assert.equal(receiptHashMatches(receiptBytes, fixture.examples.receiptObject.sha256), true);
  const tampered = Buffer.from(receiptBytes);
  tampered[tampered.length - 1] ^= 0xff;
  assert.equal(receiptHashMatches(tampered, fixture.examples.receiptObject.sha256), false);
});
