---
name: wrap-up
description: Tổng hợp/tóm tắt phiên làm việc để chuẩn bị /compact, hoặc khi kết thúc làm việc thì tổng hợp cả ngày ghi vào docs/WORKLOG.md. Dùng khi người dùng nói "kết thúc", "xong việc hôm nay", "chuẩn bị compact", "context sắp đầy", "tóm tắt phiên", hoặc gõ /wrap-up.
---

# wrap-up — quản lý context & nhật ký ngày

Skill này có **2 chế độ**. Tự phát hiện chế độ từ ngữ cảnh; nếu mơ hồ, hỏi
1 câu ngắn rồi làm.

- **SESSION** (mặc định, hoặc args rỗng / "session" / khi context sắp đầy):
  tóm tắt phiên hiện tại để người dùng `/compact`. KHÔNG ghi file.
- **DAY** (khi người dùng báo kết thúc làm việc: "kết thúc", "xong hôm
  nay", "nghỉ", "eod", args = "day"|"eod"): tổng hợp cả ngày → **append**
  vào `docs/WORKLOG.md` → báo hoàn thành để người dùng `/compact`.

## Nguyên tắc cốt lõi (áp dụng cho cả hai chế độ)

**Không bao giờ re-summarize thứ đã có nơi lưu trữ bền vững.**
`memory/*.md` và `docs/WORKLOG.md` đã giữ history, decisions, constraints.
Compact summary chỉ capture **ephemeral session state** — thứ chưa ở đâu khác.
Pointer ngắn đến file liên quan là đủ; không lặp lại nội dung của chúng.

**Chỉ tóm tắt thứ liên quan đến dự án hoặc vận hành.** Khi tự động tóm
tắt, chỉ giữ những gì gắn với codebase, quyết định kỹ thuật, công việc
đang/đã làm, ràng buộc, hoặc quy trình vận hành (deploy, sync, test...).
**Bỏ qua nội dung ngẫu hứng / lạc đề** mà người dùng thêm vào cuộc trò
chuyện: tò mò khám phá (xem repo lạ, hỏi vu vơ), nhánh chuyện không dẫn
tới hành động hay quyết định nào cho dự án. Nếu một đoạn lạc đề **lại dẫn
tới** một quyết định/hành động cụ thể cho dự án thì chỉ ghi lại phần kết
quả đó, không ghi cả quá trình tản mạn.

## Chế độ SESSION

1. Rà lại phiên. Chỉ ghi những gì **chưa có** trong `memory/*.md` hoặc
   `WORKLOG.md`:
   - Quyết định **đang treo** chưa commit vào memory
   - Trạng thái mid-task (đang làm đến đâu, file nào đang mở)
   - Lý do chọn hướng cụ thể trong phiên này mà chưa được ghi lại
   - Bước tiếp theo hợp lý
   - Pointer ngắn đến memory/file liên quan (không re-summarize nội dung)
2. In tóm tắt đó ra cho người dùng (markdown, có cấu trúc, súc tích).
3. Kết thúc bằng đúng một dòng: *"Xem lại rồi chạy `/compact` khi sẵn
   sàng."*
4. KHÔNG sửa file, KHÔNG commit.

## Chế độ DAY

1. **Xác minh git** để lấy hash/chính xác: `git log --oneline -10` và
   `git status -sb`. Không suy đoán hash.
2. Tổng hợp **chỉ những gì mới trong ngày hôm nay** chưa có trong
   `memory/*.md` hay `WORKLOG.md` sections A–H: commit hash + tên commit,
   file thay đổi chính, quyết định mới, ràng buộc mới phát sinh, việc treo.
   Không lặp lại A–H hay memory đã có.
3. Đọc `docs/WORKLOG.md`. **Append-only**: KHÔNG viết lại / không sửa các
   mục A–H sẵn có. Tìm mục `## Nhật ký theo ngày (append-only)` ở cuối
   file:
   - Nếu có: thêm một mục con `### <YYYY-MM-DD>` mới (hoặc bổ sung vào
     mục ngày hôm nay nếu đã tồn tại — vẫn append, không xoá nội dung cũ).
   - Nếu chưa có: tạo section `## Nhật ký theo ngày (append-only)` ở
     **cuối** file rồi thêm `### <YYYY-MM-DD>`.
   - Lấy ngày từ dòng `Today's date` trong context. Chuyển mọi mốc tương
     đối thành ngày tuyệt đối.
4. Nội dung mục ngày: gạch đầu dòng ngắn — commit hash, file chính, trạng
   thái (đã push?), quyết định mới, việc treo. Súc tích, không lặp lại A–H.
5. Nếu có **fact bền vững / quyết định treo / ràng buộc mới** chưa có trong
   memory: cập nhật memory file tương ứng (1 fact/file + cập nhật
   `MEMORY.md`). Không nhân bản fact đã có.
6. **KHÔNG commit `docs/WORKLOG.md`** trừ khi người dùng yêu cầu rõ.
7. Báo hoàn thành ngắn gọn + đúng một dòng cuối: *"Đã ghi nhật ký ngày
   vào `docs/WORKLOG.md`. Chạy `/compact` khi sẵn sàng."*

## Ràng buộc (áp dụng cho cả hai chế độ)

- Không bao giờ commit/push trừ khi người dùng yêu cầu rõ.
- Không in / không ghi bí mật (token, API key, VAPID private).
- Không bảo người dùng xoá localStorage / "Clear site data".
- Tôn trọng các ràng buộc trong bộ nhớ dài hạn (xem `MEMORY.md`).
- Tóm tắt phải **trung thực**: test fail thì nói fail kèm output; bước bị
  bỏ thì nói bị bỏ; xong & đã verify thì nói thẳng, không vòng vo.

## Nhắc chủ động (ngoài skill — hành vi đứng)

Skill chỉ chạy khi được gọi. Việc *chủ động nhắc khi context sắp đầy* là
một hành vi đứng được lưu trong bộ nhớ dài hạn (memory
`context-wrap-discipline`), không phải logic của skill này. Khi nhắc,
luôn nói rõ đó là **ước lượng** (không có số % chính xác), và gợi ý gõ
`/wrap-up`.
