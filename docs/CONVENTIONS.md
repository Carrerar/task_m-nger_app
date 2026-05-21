# Quy ước & ràng buộc đang hiệu lực

Các quy tắc áp dụng **qua mọi phiên làm việc**. Đây là tài liệu tham chiếu
sống — cập nhật khi quy ước đổi. (Sổ kỹ thuật ở [DESIGN.md](DESIGN.md), nhật ký
ở [WORKLOG.md](WORKLOG.md).)

## Bí mật

- **KHÔNG BAO GIỜ commit:** `SYNC_TOKEN`, `ANTHROPIC_API_KEY`, VAPID
  private key, Cloudflare API/account token. (KV namespace id trong
  `wrangler.toml` commit được — an toàn.)
- Không in/log giá trị bí mật.

## Dữ liệu người dùng

- **KHÔNG BAO GIỜ** bảo xoá localStorage / "Clear site data" (mất
  `personal_productivity_data_v1` + cấu hình sync). Reload SW = chỉ
  unregister SW + xoá Cache storage, **không đụng localStorage**.
- Export-data là lưới an toàn duy nhất trước khi làm việc rủi ro.

## Git & commit

- **Người dùng duyệt TỪNG commit và push** (hỏi trước commit; hỏi trước
  push). Commit thẳng `main`. Trailer:
  `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.
- Không nêu lại mục đã từ chối: email committer công khai;
  serve.mjs/0.0.0.0 LAN-bind.

## Quy trình sửa code

- Sửa code → bump `sw.js` CACHE nếu đụng file precache → `npm test` +
  `npm run build` → **DỪNG trước commit, chờ duyệt**.
- Roll out thận trọng: test xanh → build → verify trên **room của mình
  trước** → rồi mới báo người khác update.
- Cảnh báo lint cosmetic là false-positive — bỏ qua: LF→CRLF, MD041
  (frontmatter), MD060 (canh lề pipe trong bảng — render vẫn đúng).

## Data contract

- Data contract = API công khai: chỉ thay đổi **cộng thêm**; đổi shape
  phải bump `schemaVersion` + migration khoan dung trong `loadData()`.

## Khác

- Room ID luôn dài/ngẫu nhiên — không gợi ý id ngắn/dễ đoán (ngoại lệ:
  id người dùng cố ý chọn).
- Không tự spawn subagent trừ khi được yêu cầu rõ.
