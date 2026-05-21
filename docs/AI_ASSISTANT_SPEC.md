# Step 2 — AI Assistant Spec

Bản thiết kế cho tính năng trợ lý AI của Focus Board (`js/features/assistant.js`).
Đã qua kiểm chứng cứ (the-fool, Falsification) — phản ánh **vị thế đã gia cố**, không
phải bản nháp đầu. Mọi quyết định đều bám code thật; tham chiếu file:line ở dưới.

> **Trạng thái:** SPEC — ⏸ **TẠM HOÃN từ 2026-05-21** (chưa đủ tiền nạp credit
> tối thiểu Anthropic, ~$100). Spec + spike (`scripts/spike-assistant.mjs`) đã sẵn
> sàng; tiếp tục từ §12 khi có credit. Implementation là Opus tripwire.
> **Phạm vi:** chỉ Step 2. Không đụng data contract theo cách phá vỡ (xem §9).

---

## 1. Mục tiêu & không-mục-tiêu

**Mục tiêu (v1):** một panel chat, người dùng ra lệnh tiếng Việt tự nhiên ("thêm
task học bài 2 tiếng chiều mai", "hôm nay tôi xong mấy việc rồi", "dời buổi đi bộ
sang 7h tối"), assistant đọc/sửa dữ liệu task qua tool-use loop chạy **client-side**.

**Không-mục-tiêu (v1):** background loop / heartbeat, voice, memory tree + vector
search, auto-fetch, multi-turn memory bền vững giữa các phiên. (Có thể xét sau.)

---

## 2. Kiến trúc tổng thể

```
[Chat panel UI]  ──►  assistant.js (tool-use loop)  ──►  POST /<room>/ai
   (index.html)          │                                  (Worker proxy,
                         │                                   pass-through → Anthropic)
                         ├─ buildSnapshot()  ← state.data (scoped + projected)
                         ├─ TOOLS (read + write JSON schemas)
                         └─ headlessActions ─► hàm feature sẵn có (tasks.js, recurring.js)
                                                   │
                                                   └─ beginBatch()/endBatch() (bus.js)
                                                      → 1 saveData() + 1 render() / lượt
```

Nguyên tắc nền: **không ghi thẳng `localStorage`**. Mọi mutation đi qua hàm feature
đã được test → tự động tôn trọng `loadData()`/`capSessions()`/`schemaVersion`
([store.js:9](../js/core/store.js#L9)). Đã xác minh các hàm này nhận tham số, không
đọc DOM ([tasks.js:129](../js/features/tasks.js#L129), [tasks.js:164](../js/features/tasks.js#L164)).

---

## 3. Data shapes (tham chiếu, không đổi)

**Task** ([tasks.js:141](../js/features/tasks.js#L141)):
`{ id, name, note, category, plannedMinutes, date "YYYY-MM-DD",
   status "idle|running|paused|complete", remainingSeconds, elapsedSeconds,
   lastStartedAt, firstStartedAt, endedAt, scheduledStartAt, scheduledEndAt,
   rating, createdAt, completedAt, archived, recurringId? }`

**Recurring template** ([recurring.js:74](../js/features/recurring.js#L74)):
`{ id, name, note, category, plannedMinutes, startTime "HH:MM",
   type "daily|weekdays|weekly", weekday?, active }`

**Session** ([tasks.js:55](../js/features/tasks.js#L55)): chỉ đọc — assistant không
tạo session trực tiếp (sinh ra qua timer). Bị giới hạn `SESSION_CAP`.

---

## 4. Batch save — thay đổi nhỏ ở `bus.js` (KHÔNG refactor tasks.js)

Mỗi hàm feature tự gọi `saveAndRender()` ([bus.js:25](../js/core/bus.js#L25)) →
`saveData()` (kích `afterSave` → sync push → **1 KV write**) + `render()`. Nếu
assistant tạo 5 task = 5 KV write. Giải pháp gọn: cho `saveAndRender` **coalesce**
khi đang trong batch.

```js
// bus.js — thêm
let batchDepth = 0, pendingSave = false, pendingRender = false;

export function beginBatch() { batchDepth += 1; }
export function endBatch() {
  batchDepth = Math.max(0, batchDepth - 1);
  if (batchDepth === 0) {
    if (pendingSave)   { saveData(); pendingSave = false; }
    if (pendingRender) { renderer(); pendingRender = false; }
  }
}
export function saveAndRender() {
  if (batchDepth > 0) { pendingSave = pendingRender = true; return; }
  saveData(); renderer();
}
```

Assistant bọc mỗi lượt thực thi tool trong `beginBatch()` … `endBatch()`. Tất cả
`saveAndRender()` của các hàm feature gộp lại thành **1 save + 1 render/lượt**.
→ Bảo vệ KV write budget chung mà không sửa `tasks.js`/`recurring.js`.

---

## 5. Context strategy — snapshot scoped + projected (KHÔNG nhồi `state.data`)

Đo thực tế: ~60-70 task/tuần ≈ 6-8k token nếu gửi thô. → Không gửi toàn bộ lịch sử.

`buildSnapshot()` trả về JSON gọn cho **cửa sổ liên quan** (hôm nay + tuần hiện tại),
chỉ field model cần — **bỏ** `remainingSeconds`, `elapsedSeconds`, `lastStartedAt`,
`scheduledEndAt`, các timestamp nội bộ:

```json
{
  "today": "2026-05-21",
  "tasks": [
    { "id": "…", "name": "code app", "date": "2026-05-21",
      "time": "19:34", "minutes": 120, "status": "complete", "category": "học trên trường" }
  ],
  "recurring": [ { "id": "…", "name": "đi bộ", "type": "daily", "time": "16:00", "minutes": 60 } ],
  "categories": ["học trên trường", "Sức khỏe", "giải trí"]
}
```

Ước ~2-3k token → đủ rẻ để nhồi thẳng vào system prompt. **Read tool chỉ là ngoại
lệ** cho truy vấn ngoài cửa sổ ("tháng trước…"). → ít round-trip → đỡ cap 100/ngày.

---

## 6. Tool catalog (JSON schema cho Messages API)

### Read tools (thực thi ngay, không tốn KV)
| Tool | Input | Map tới |
|---|---|---|
| `query_tasks` | `{ date?, from?, to?, status?, category? }` | lọc `state.data.tasks` (projected) |
| `get_day_summary` | `{ date }` | tổng hợp planned vs done, drift cho 1 ngày |
| `list_recurring` | `{}` | `state.data.recurring` (projected) |
| `list_categories` | `{}` | `state.data.categories` |

### Write tools (bọc trong beginBatch/endBatch)
| Tool | Input | Map tới hàm feature |
|---|---|---|
| `add_task` | `{ name, minutes, date?, time?, category?, note? }` | `addTask(...)` [tasks.js:129](../js/features/tasks.js#L129) |
| `update_task` | `{ taskId, name?, minutes?, date?, time?, category?, note? }` | `updateTask(taskId, {...})` [tasks.js:164](../js/features/tasks.js#L164) |
| `complete_task` | `{ taskId }` | `toggleComplete(taskId)` [tasks.js:288](../js/features/tasks.js#L288) |
| `reschedule_task` | `{ taskId, date, startMinute }` | `rescheduleTask(...)` [tasks.js:203](../js/features/tasks.js#L203) |
| `delete_task` ⚠️ | `{ taskId }` | `deleteTask(taskId)` — **cần xác nhận** |
| `create_recurring` | `{ name, minutes, type, weekday?, startTime?, category?, note? }` | `addRecurring({...})` + `applyRecurringToday()` [recurring.js:74](../js/features/recurring.js#L74) |
| `delete_recurring` ⚠️ | `{ recurringId }` | `deleteRecurring(id)` — **cần xác nhận** |
| `start_timer` | `{ taskId }` | `startTask(taskId)` [tasks.js:219](../js/features/tasks.js#L219) |
| `stop_timer` | `{ taskId, finish? }` | `pauseTask` / `finishTaskEarly` |

**Lưu ý map:**
- `complete_task` dùng `toggleComplete` (manual complete, không cần timer chạy).
- `clearCompletedToday` ([tasks.js:337](../js/features/tasks.js#L337)) đọc `ui.taskBoardDate`
  → **không expose trực tiếp**; nếu cần "ẩn task xong" thì set `ui.taskBoardDate`
  trước hoặc viết biến thể nhận `date`.
- `add_task` không nhận `status` → không tạo được task "đã xong sẵn" (chấp nhận ở v1).

---

## 7. Vòng lặp tool-use (client-side)

```
buildSnapshot() → system prompt + messages=[user]
loop (tối đa MAX_ROUNDTRIPS = 5):
  POST /<room>/ai  { model, max_tokens, system, messages, tools }
  nếu stop_reason == "tool_use":
     beginBatch()
     với mỗi tool_use block:
        - read tool       → thực thi ngay, đẩy tool_result
        - write thường    → thực thi qua headlessAction, đẩy tool_result
        - write ⚠️ hủy     → KHÔNG thực thi; render nút xác nhận trong chat;
                             chờ user. Confirm → thực thi + tool_result;
                             Decline → tool_result { declined: true }
     endBatch()        // 1 saveData() + 1 render() cho cả lượt
     messages.push(assistant tool_use); messages.push(user tool_result)
     tiếp tục loop
  nếu stop_reason == "end_turn":
     hiển thị text, thoát
nếu chạm MAX_ROUNDTRIPS: dừng, báo "không hoàn tất, thử lại gọn hơn"
```

Mỗi lần POST = **1 call** ăn vào cap 100/ngày của room (proxy bump *trước* khi gọi,
[sync-worker.js:118](../worker/sync-worker.js#L118)). `MAX_ROUNDTRIPS=5` vừa chống
runaway vừa giữ ~20 yêu cầu/ngày trong cap — **con số này là giả định, sẽ chốt qua
spike §11.**

---

## 8. Proxy clamp — chặn bán-kính-nổ do vô ý / lỗi (sửa `sync-worker.js`)

Lý do (bạn nêu): không lo phá hoại nhưng lo **vô ý / lỗi hệ thống**. Một bug client
set `max_tokens` khổng lồ hoặc loop sẽ đốt `ANTHROPIC_API_KEY`. Cap hiện tại chặn
*tần suất*, không chặn *chi phí mỗi call*. Thêm clamp phía server trong `handleAi`
([sync-worker.js:93](../worker/sync-worker.js#L93)):

```js
const ALLOWED_MODELS = new Set(["claude-haiku-4-5", "claude-sonnet-4-…"]);
const MAX_TOKENS_CEIL = 2048;
// sau khi parse body:
if (!ALLOWED_MODELS.has(body.model)) body.model = "claude-haiku-4-5";
if (!(body.max_tokens > 0) || body.max_tokens > MAX_TOKENS_CEIL) body.max_tokens = MAX_TOKENS_CEIL;
```

Không tin client về `model`/`max_tokens`. Đổi này cần **deploy lại Worker**.

---

## 9. Model routing (bản gọn — khớp model-selection-discipline)

- **Mặc định** `claude-haiku-4-5` (rẻ, đủ cho add/query/summarize).
- Toggle **"deep"** trong chat → client gửi `model: claude-sonnet-4-…` cho lượt đó
  (lập kế hoạch tuần, phân tích pattern).
- Proxy đã pass-through `body` → client chỉ đổi field `model` (nằm trong allowlist §8).

---

## 10. An toàn & ràng buộc (tripwire checklist)

- [ ] **Data contract**: chỉ thay đổi *additive*. Nếu cần field mới trên task →
      bump `schemaVersion` + migration trong `loadData()`. v1 KHÔNG cần field mới.
- [ ] **KV write budget**: batch 1 save/lượt (§4). Không gọi saveData thủ công.
- [ ] **Multi-user**: proxy clamp model + max_tokens (§8).
- [ ] **Prompt injection**: tên/note task là *dữ liệu, không phải lệnh* — nói rõ
      trong system prompt. Tool hủy cần xác nhận người dùng (§7).
- [ ] **Privacy**: data task **rời máy** tới Anthropic qua proxy — ghi chú cho user
      biết trong UI panel lần đầu.
- [ ] **Offline**: assistant cần mạng; nếu offline → disable input, báo rõ.
- [ ] **SW cache**: `assistant.js` + `index.html` + `styles.css` đổi → thêm
      `assistant.js` vào APP_SHELL ([sw.js:3](../sw.js#L3)) + bump CACHE.
- [ ] **Secrets**: không log body chứa nội dung; không in key.

---

## 11. Giả định rủi ro nhất + spike chốt trước

**Giả định (hạng D, chưa đo):** "Haiku chọn tool đủ tốt để không loop, ≤3
round-trip/yêu cầu."

**Spike (~50 dòng, làm trước khi viết full):** định nghĩa 3 read tool + `add_task`,
chạy 8-10 yêu cầu tiếng Việt thật trên Haiku, đếm: (a) round-trip/yêu cầu, (b) chọn
đúng tool? Nếu ≤3 & đúng → khóa Haiku mặc định. Nếu loop/sai → default Sonnet hoặc
thêm few-shot examples vào system prompt.

---

## 12. Thứ tự triển khai đề xuất

1. `bus.js` batch (§4) + test đơn vị cho beginBatch/endBatch.
2. Proxy clamp (§8) + deploy Worker.
3. `buildSnapshot()` + headlessActions + tool schemas (§5–6).
4. Loop **read-only trước**, Haiku (§7) → an toàn nhất.
5. **Spike §11** → chốt model mặc định.
6. Thêm write tools + luồng xác nhận hủy.
7. Chat panel UI (index.html + styles.css).
8. SW: thêm assistant.js vào APP_SHELL + bump cache; `npm test` + `npm run build`.

Mỗi bước: STOP chờ duyệt trước commit, theo quy trình hiện hành.
