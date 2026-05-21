# Nhật ký theo ngày — Focus Board

Nhật ký tăng dần theo ngày (append-only). Mỗi ngày một mục; không sửa mục cũ.

- **Sổ kỹ thuật** (hệ thống ra sao & vì sao, theo chủ đề): [DESIGN.md](DESIGN.md)
- **Quy ước & ràng buộc đang hiệu lực**: [CONVENTIONS.md](CONVENTIONS.md)
- **Mục lục docs**: [README.md](README.md)

---

## Nhật ký theo ngày (append-only)

> Mục 17–18 dựng lại từ lịch sử commit (lúc đó chưa ghi nhật ký ngày). Chi tiết
> kiến trúc/thiết kế xem [DESIGN.md](DESIGN.md).

### 2026-05-17

- `d46009a` — nền tảng app: export/import, inline edit, task lặp lại, refactor
  sang ES module, PWA.
- **Redesign v6/v7** (SW v8): calendar tháng+tuần (`1fd5987`), dark Railway reskin
  (`27e4dbc`), train trang trí cuộn (`d800953`), hero dusk + màu theo zone
  (`f5862a7`, `be76335`, `60094b3`), mute titlebar + ẩn scrollbar (`57a5071`).
- **Phase 1** sắp xếp file theo vai `js/core|features|ui` (`dc3665d`, SW v9).
- **Phase 2** bộ test `node:test`, 22 test, không dependency (`37b1a2d`).
- **Phase 3** hiệu năng: tách tick-render, throttle ghi localStorage, `SESSION_CAP`
  (`dacf6d7`).
- Inline edit name+phút (`69af6fd`); drag-drop reschedule tuần snap 5' (`e287858`).
- `d0909a4` — fix layout composer, bỏ field "nghỉ sau task", materialise lịch lặp
  +60 ngày. SW v13.

### 2026-05-18

- `d322509` — **đồng bộ đa thiết bị** (Worker sync + KV), fix edit-banner không ẩn,
  thêm field note cho task. SW v14→v15.
- `7a5c26c` — build tĩnh cho Cloudflare Pages (`scripts/build-static.mjs`) để né
  cap asset 25 MiB. **Phase 5 sync DEPLOYED & VERIFIED.**
- **Mobile/responsive** (CSS-only, một codebase, SW v16→v23): layout hẹp →
  phone bỏ calendar, card tối giản, hero `aspect-ratio:1/1`, train-rail overlay
  zero-footprint (`ba1e452`, `422cfc2`, `033e447`, `c674c02`, `09be300`, `23cfbaf`,
  `b6c8f6f`).
- Multi-user: mới ở mức **tìm hiểu** (chốt làm vào 05-19).

### 2026-05-19

- Không có commit mới (tree clean, HEAD vẫn `a8f011d`)
- Tạo `docs/WORKLOG.md` (lịch sử A–H, chưa commit — append-only)
- Tạo `.claude/skills/wrap-up/SKILL.md` (SESSION + DAY mode)
- Tạo 3 memory files: `ai-agent-plan.md`, `context-wrap-discipline.md`,
  `model-selection-discipline.md`; cập nhật `MEMORY.md`
- Chốt rule: default Sonnet, hard tripwires → STOP + recommend Opus
- AI agent: thiết kế xong (7-step plan), chưa code — blocked chờ chốt model
  (Workers AI vs Claude API / Haiku 4.5 ~$6-14/mo)
- Cập nhật wrap-up skill + context-wrap-discipline: compact summary chỉ
  capture ephemeral state, không re-summarize memory/WORKLOG đã có

### 2026-05-20

- Push `d1db305` + `d3c1611` (AI proxy Step 1+1b, committed lúc trước) lên `origin/main`
- Commit `6308b46` (UI, SW v26) — đã push. Files: `index.html`, `styles.css`,
  `js/core/dom.js`, `js/core/ui-state.js`, `js/features/recurring.js`,
  `js/features/calendar.js`, `js/main.js`, `sw.js`
  - Nút thu gọn/mở rộng cho phần lịch lặp lại (`ui.recurringCollapsed`, `#recurringCollapseBtn`)
  - Week block: note luôn hiện trên block cao (≥ HOUR_HEIGHT), hover tooltip trên block thấp
  - Regrouped task-panel buttons thành 2 hàng: primary (Thêm công việc + Ẩn task xong) & secondary (export/import/sync — nhỏ hơn)
  - h2 đổi thành "Task và timer" (bỏ "riêng"), to hơn (`1.55rem`)
- Tests: 41/41 pass. Không có test mới thêm hôm nay.
- Pending: user cần `wrangler secret put ANTHROPIC_API_KEY` + `wrangler deploy` để AI proxy hoạt động; Step 2 (assistant.js) sau đó — Opus tripwire.

### 2026-05-21

- **Sửa lỗi UI (đã push):**
  - `6953b1b` — nút thu gọn lịch lặp lại không ẩn được danh sách. Nguyên nhân:
    `.recurring-list{display:grid}` đè `[hidden]`. Thêm `.recurring-list[hidden]{display:none}`. SW v26→v27.
  - `31ede76` — "Ẩn task xong" làm task biến mất cả trên lịch. Bỏ filter
    `!task.archived` ở `js/features/calendar.js` (checklist vẫn ẩn qua selectors). SW v27→v28.
- **`328cc6b` (đã push)** — trang bị 6 agent-skills vào `.claude/skills/`
  (cloudflare-deploy, web-design-guidelines, accessibility, playwright-skill,
  security-threat-model, the-fool) + cập nhật wrap-up: tóm tắt tự động chỉ giữ
  nội dung dự án/vận hành, bỏ phần lạc đề.
- **Mảng AI — TẠM HOÃN (lý do tài chính):** không đủ tiền nạp credit tối thiểu
  Anthropic (thấy mốc ~$100). Đã viết sẵn artifact chờ: `docs/AI_ASSISTANT_SPEC.md`
  (spec Step 2, đã qua pre-mortem the-fool/Falsification) + `scripts/spike-assistant.mjs`
  (đo tool-selection Haiku, chưa chạy). Không push mảng AI tới khi có credit.
- **Tách lại docs theo vai (chưa commit):** WORKLOG cũ 329 dòng gộp 4 thứ → tách
  thành: `WORKLOG.md` (nhật ký ngày — "hôm đó làm gì"), `DESIGN.md` (sổ kỹ thuật
  sống — "hệ thống ra sao & vì sao", theo chủ đề), `CONVENTIONS.md` (quy ước/luật),
  `README.md` (mục lục). Qua 2 vòng the-fool (Falsification rồi Socratic): chốt biến
  quyết định là *vai trò nội dung*, không phải số file. Cập nhật wrap-up skill khớp.
  - Cũng dựng lại nhật ký ngày **17–18** từ lịch sử commit; `DESIGN.md` hấp thụ
    2 fix UI hôm nay dạng "gotcha" (mẫu `[hidden]` bị `display` đè; archived).
  - Cập nhật `TESTING.md` (thêm `worker.test.js`), `AI_ASSISTANT_SPEC.md` (trạng
    thái ⏸ hoãn). Lint MD060 (canh lề bảng) ghi nhận là cosmetic-bỏ-qua.
- **Chưa commit cuối ngày 21/5** (nothing new pushed beyond 3 commit trên):
  `M .claude/skills/wrap-up/SKILL.md`, `M docs/TESTING.md`, và mới:
  `docs/{AI_ASSISTANT_SPEC,CONVENTIONS,DESIGN,README,WORKLOG}.md`,
  `scripts/spike-assistant.mjs`. (`docs/HISTORY.md` tạo rồi xóa trong ngày — chưa
  từng track.) User chưa quyết gộp/tách commit.
- Trạng thái: HEAD `328cc6b`, `main == origin/main`, SW v28, tests 41/41 pass.
