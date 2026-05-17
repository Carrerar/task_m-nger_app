import test from "node:test";
import assert from "node:assert/strict";
import {
  createId,
  escapeHtml,
  normalizeCategory,
  normalizeCategories,
} from "../js/core/utils.js";

test("escapeHtml neutralises HTML-significant characters", () => {
  assert.equal(
    escapeHtml(`<a href="x">'&'</a>`),
    "&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;",
  );
  assert.equal(escapeHtml(42), "42");
});

test("normalizeCategory trims and collapses inner whitespace", () => {
  assert.equal(normalizeCategory("  Học   tập \t "), "Học tập");
  assert.equal(normalizeCategory("Code"), "Code");
});

test("normalizeCategories dedupes, drops blanks, and sorts", () => {
  const out = normalizeCategories(["b", "  a  ", "a", "   ", "Sức   khỏe"]);
  assert.equal(out.length, 3);
  assert.deepEqual([...out].sort(), ["Sức khỏe", "a", "b"].sort());
  assert.ok(!out.includes(""));
  // idempotent
  assert.deepEqual(normalizeCategories(out), out);
});

test("createId is unique and shaped <ms>-<hex>", () => {
  const a = createId();
  const b = createId();
  assert.match(a, /^\d+-[0-9a-f]+$/);
  assert.notEqual(a, b);
});
