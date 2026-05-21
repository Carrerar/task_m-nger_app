# Thiết kế & kỹ thuật Focus Board

Sổ kỹ thuật **sống**: hệ thống hoạt động ra sao & vì sao — kiến trúc, thiết kế,
cách từng tính năng vận hành, và những lỗi đáng nhớ + cách sửa. Tổ chức **theo
chủ đề**, cập nhật khi có thay đổi đáng nhớ về mặt cấu trúc.

> Phân biệt: file này = "hệ thống ra sao". Nhật ký theo ngày ("hôm đó làm gì")
> ở [WORKLOG.md](WORKLOG.md); quy ước/luật ở [CONVENTIONS.md](CONVENTIONS.md);
> mục lục ở [README.md](README.md).
>
> App: PWA vanilla JS, dữ liệu `localStorage` (`personal_productivity_data_v1`),
> repo `github.com/Carrerar/task_m-nger_app` (branch `main`, public). Bản ghi
> dưới đây bắt đầu từ đợt phát triển 2026-05-17.

---

## A. Lộ trình 5 giai đoạn (nền tảng, 2026-05-17)

Làm **toàn bộ** lộ trình + "sắp xếp file logic". Không song song hoá vì đổi vị
trí file sẽ phá `APP_SHELL` của SW, đường dẫn import ES module, và scope manifest.

| Phase | Nội dung | Trạng thái | Commit |
|---|---|---|---|
| 0 | Bảo mật | DONE | `57a5071` + push |
| 1 | Sắp xếp lại file | DONE | `dc3665d` + push |
| 2 | Test tự động | DONE | `37b1a2d` + push |
| 3 | Hiệu năng | DONE | `dacf6d7` + push |
| 4 | Tính năng | ĐANG TIẾP | nhiều commit |
| 5 | Đồng bộ đa thiết bị | DEPLOYED | `d322509`, `7a5c26c` + push |

### Phase 0 — Bảo mật

Audit bảo mật: repo sạch, trừ (a) email committer công khai trong git
history, (b) `serve.mjs`/python http.server bind `0.0.0.0`. **Người dùng
chọn "không cần" cả hai** → không sửa, không nêu lại.

### Phase 1 — Sắp xếp lại file (`dc3665d`)

Toàn bộ bằng git-rename (giữ history). Layout cuối:

- `js/core/` — bus, store, ui-state, constants, time, utils, dom, selectors
- `js/features/` — tasks, recurring, categories, composer, io, dashboard, calendar
- `js/ui/` — render, train, audio
- `js/main.js` ở gốc `js/`
- `assets/` — icon.svg, bg-train-dusk.png
- `docs/` — tài liệu
- index.html / manifest / sw.js / serve.mjs / styles.css / .bat ở gốc

Rewrite import; SW cache → `focus-board-v9`.

### Phase 2 — Test tự động (`37b1a2d`)

`package.json` gốc `{"type":"module","scripts":{"test":"node --test"}}`,
**không dependency**. 22 test trong `tests/{time,utils,selectors}.test.js`.
Intl assertion chỉ check chữ số (Chrome "/" vs Node ICU "-"). `node_modules/`
gitignored. Lưu ý: `type:module` ở gốc khiến smoke harness không cần
`js/package.json` tạm nữa. (Phạm vi test cập nhật ở [TESTING.md](TESTING.md).)

### Phase 3 — Hiệu năng (`dacf6d7`)

Audit 3 mục, ship cả 3:

1. Tách tick-render khỏi full-render — `bus.setTickRenderer`/`renderTick`;
   `tickRender` = renderTasks + renderActiveFocus + `renderClockNow`.
2. Throttle ghi localStorage `TICK_SAVE_MS=12000` + flush ở
   `visibilitychange`.
3. `SESSION_CAP=1000` ở store load+save (`data.sessions` chỉ ghi, không
   đọc → cap cho an toàn).

Đánh đổi chấp nhận: metric phút-focus ở dashboard trễ trong lúc timer chạy
tới state change / nhịp 60s. **Mục 4 (memoize categories) CHƯA làm — vẫn
tùy chọn.**

### Phase 4 — Tính năng (đang tiếp)

- Inline task edit (`69af6fd`, SW v11) — card "Sửa" → editor name+phút.
- Drag-drop reschedule tuần (`e287858`, SW v12) — snap 5 phút.
- **Chưa làm (chưa yêu cầu): Notification khi timer xong; filter/search
  task.**

### Phase 5 — Đồng bộ đa thiết bị (DEPLOYED & VERIFIED 2026-05-18)

- App live: `https://taskmanager-ujx.pages.dev` (Cloudflare Pages,
  Git-connected, auto-redeploy mỗi push, build `npm run build`, output
  `dist`).
- Worker sync: `https://focus-board-sync.focus-board.workers.dev` (KV
  binding **phải** tên `STATE`; `SYNC_TOKEN` là wrangler secret, không
  trong repo).
- Cơ chế: server giữ `{rev,updatedAt,data}`, PUT bump `rev`,
  **last-write-wins**. Client `js/features/sync.js` (DOM-free, `decideSync`
  unit-test). Token+URL chỉ ở `localStorage`. `onAfterSave(schedulePush)`
  debounce 4s, pull lúc khởi động + visibilitychange.
- **Build-fix `7a5c26c`:** Cloudflare deploy cả repo root → đụng cap 25
  MiB ở `node_modules/workerd` (~119 MiB). Sửa bằng
  `scripts/build-static.mjs` (zero-dep, copy file vào `dist/`). GOTCHA:
  flow "Create application" của Cloudflare mặc định vào **Workers** (sai,
  fail asset-size); phải vào flow **Pages** qua link nhỏ "Looking to
  deploy Pages?".

---

## B. Giao diện (UI/UX)

### Redesign v6/v7 (2026-05-17)

Gộp lớn trên `d46009a`, ship thành nhiều commit:

1. **Calendar tháng + tuần** — `js/calendar.js`, lane-pack tuần, now-line,
   toggle Tháng/Tuần.
2. **Railway dark reskin** — `:root` dark + accent tím `#a472f6`,
   `color-scheme:dark`, recolor manifest/icon.
3. **Scroll train** — `js/train.js`, SVG tàu theo zone (calendar tím /
   task xanh / dashboard teal), pointer-events none, tôn trọng
   reduced-motion.
4. **Hero dusk** — `.hero` bọc topbar+calendar, ảnh nền
   `bg-train-dusk.png`, overlay tối để dễ đọc.
5. **Nền theo màu tàu** — `--train-color` toàn cục, body background-color
   `color-mix` 14% màu tàu, transition 600ms.

Commit: `1fd5987` → … → `57a5071` (mute titlebar #141a3a + ẩn scrollbar). SW lên `v8`.

### Mobile/responsive (2026-05-18, CSS-only, một codebase)

**Quyết định kiến trúc:** KHÔNG fork UI mobile riêng — giữ một codebase
responsive + CSS/behaviour ≤640px nhắm đích.

- Phone bỏ hẳn calendar (`.calendar-panel{display:none}`), card tối giản; day-nav
  qua picker `#taskBoardDate` (`033e447`).
- Hero phone `aspect-ratio:1/1`; train-rail thành overlay
  `position:fixed;pointer-events:none` zero-footprint (`23cfbaf`).
- SW v16→v23 qua loạt commit `ba1e452`/`422cfc2`/`033e447`/`c674c02`/`09be300`/`23cfbaf`/`b6c8f6f`.

### Gotcha CSS: `[hidden]` bị `display:` đè (mẫu lặp lại)

Thuộc tính `hidden` của HTML chỉ là `display:none` ở **UA stylesheet** (ưu tiên
thấp nhất). Bất kỳ rule tác giả đặt `display:` (grid/flex) sẽ **thắng** → phần tử
vẫn hiện dù đã set `el.hidden = true`. Cách sửa: thêm rule scoped
`.x[hidden]{display:none}`. Đã gặp ở:

- `.edit-banner` (`d322509`).
- `.recurring-list` — nút thu gọn lịch lặp không ẩn được; sửa SW v26→v27 (`6953b1b`).

### "Ẩn task xong" chỉ ẩn ở checklist, không ẩn trên lịch (`31ede76`, SW v28)

Nút "Ẩn task xong" đặt `task.archived = true`. Trước đó cả checklist lẫn lịch đều
lọc bỏ `archived` → task xong biến mất ở cả hai. Bỏ filter `!task.archived` trong
`js/features/calendar.js` (`tasksByDate`); checklist vẫn ẩn qua
`js/core/selectors.js`. → Lịch hiển thị đầy đủ lịch trình, checklist gọn.

---

## C. Đa người dùng — mỗi người một bảng riêng (2026-05-19, `9b5463d`)

Mô hình danh tính: **Token chung (cổng chống lạm dụng) + Room ID riêng (không
gian dữ liệu)**.

- **worker/sync-worker.js**: KV key = `state:<roomId>` lấy từ path URL.
  `ROOM_RE=/^[A-Za-z0-9._-]{6,128}$/`, sai/thiếu → 400 `bad-room`. Cổng
  token + OPTIONS giữ nguyên, return *trước* khi check room (preflight
  không có Authorization).
- **js/features/sync.js**: thêm `fb_sync_room`; cần đủ url+token+room; `api()`
  gọi `<url>/<room>`; đổi room thì reset `fb_sync_rev`.
- **Rủi ro còn lại:** ai có token chung mà đoán đúng room id người khác thì đọc
  được room đó → **room id phải dài/ngẫu nhiên**.

### Giới hạn Cloudflare free tier (nút thắt thật)

| Tài nguyên | Hạn mức | |
|---|---|---|
| **KV writes** | **1.000/ngày toàn account** | nút thắt |
| KV reads | 100.000/ngày | thoải mái |
| Worker requests | 100.000/ngày | thoải mái |
| KV storage | 1 GB | thoải mái |

Timer chạy ≈ **300 KV writes/giờ** nếu mỗi checkpoint push → free tier
chỉ ~3 giờ-timer/ngày *cho cả nhóm*. Khi hỏi scale, câu trả lời thật là **ngân
sách write**, không phải số người.

---

## D. Giảm tải KV (2026-05-19, `a8f011d`)

Bỏ push ở checkpoint giữa timer:

- **js/core/store.js**: tách `persist()`. `saveData()` = `persist()` + `afterSave`.
  Mới: `saveDataLocal()` chỉ `persist()` (không afterSave → không lên lịch push).
- **js/features/tasks.js**: checkpoint 12s trong ticker đổi `saveData()` →
  `saveDataLocal()`. SW `v24→v25`.

Kết quả: mất ~300 writes/giờ/timer, **không mất dữ liệu** (vẫn lưu localStorage
12s/lần; sync chỉ chạy ở hành động thật + tab-hide/close/day-roll/timer-done).
Không đổi data contract.

---

## E. AI agent — đã thiết kế (xem spec hiện hành)

Thiết kế: trợ lý cá nhân hỏi đáp + tạo/xoá/sắp xếp/thông báo task; client chạy
vòng tool-use, Worker = proxy mỏng giữ API key; tool map vào hàm sẵn có; thao tác
phá huỷ → thẻ confirm; thông báo nền = Web Push (VAPID + Cron Trigger + KV ledger
"sent"); `task.reminders` ⇒ bump `schemaVersion`.

Step 1+1b (proxy → Anthropic) đã code & push. **Spec chi tiết & cập nhật ở
[AI_ASSISTANT_SPEC.md](AI_ASSISTANT_SPEC.md)** (đã qua pre-mortem). Hiện ⏸ **tạm
hoãn** vì chưa đủ credit Anthropic — xem nhật ký [WORKLOG.md](WORKLOG.md).

---

## F. Nghiên cứu phụ (đã đóng)

- Nền tảng: Cloudflare Pages + Worker + KV; wrangler CLI; app là PWA vanilla,
  `npm run build` chỉ copy file (không transpile/bundle).
- Bảo mật "app tự nhớ URL+token": không đáng lo ở điều kiện cá nhân/nhóm tin
  cậy; mã hoá localStorage không tăng an toàn thực; rủi ro chỉ ở
  XSS/extension/máy chung.
- Plugin `superpowers`: **không khuyến nghị trang bị** (không cài được ở môi
  trường này, trùng kỷ luật sẵn có).
