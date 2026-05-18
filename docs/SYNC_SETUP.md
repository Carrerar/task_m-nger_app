# Đồng bộ nhiều thiết bị (điện thoại ↔ máy tính)

Focus Board lưu toàn bộ dữ liệu trong trình duyệt. Để dùng chung dữ liệu
giữa các thiết bị, ta host bản web tĩnh + một Cloudflare Worker nhỏ giữ một
bản snapshot JSON. Tất cả **miễn phí** ở mức dùng cá nhân.

Mô hình: server giữ `{ rev, updatedAt, data }`. Mỗi lần ghi `rev` tăng. Máy
nào mở app sẽ kéo về nếu server mới hơn; mọi thay đổi cục bộ được đẩy lên
(gộp lại, đẩy sau ~4 giây). **Last-write-wins**.

> Đánh đổi đã chấp nhận: nếu **cùng lúc** sửa offline trên cả hai máy rồi cả
> hai cùng lên mạng, máy đẩy sau sẽ ghi đè. Với một người dùng xoay vòng
> giữa các máy (mở máy nào thì máy đó kéo bản mới trước khi sửa) thì điều này
> hầu như không xảy ra.

## A. Tạo Cloudflare Worker (1 lần)

Cài Node rồi chạy trong thư mục `worker/`:

```bash
cd worker
npx wrangler login                       # mở trình duyệt, đăng nhập Cloudflare (miễn phí)
npx wrangler kv namespace create STATE   # in ra một id
```

Mở `worker/wrangler.toml`, dán id vừa nhận vào `id = "..."`.

Đặt mã bí mật (chuỗi ngẫu nhiên dài — đây là thứ duy nhất bảo vệ dữ liệu,
**đừng commit, đừng chia sẻ**):

```bash
npx wrangler secret put SYNC_TOKEN
# dán một chuỗi ngẫu nhiên, ví dụ tạo bằng:
#   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"

npx wrangler deploy
```

Wrangler in ra URL dạng `https://focus-board-sync.<tên>.workers.dev`. Giữ lại
URL này và chuỗi token.

> Không thích dùng CLI? Trong dashboard Cloudflare: **Workers & Pages → Create
> → Worker**, dán nội dung `worker/sync-worker.js`, thêm **KV namespace
> binding** tên `STATE`, thêm **Secret** tên `SYNC_TOKEN`, rồi Deploy.

## B. Host bản web (1 lần)

Cloudflare Pages: **Workers & Pages → Create → Pages → Upload assets** (hoặc
nối Git repo). Tải lên toàn bộ thư mục dự án (trừ `worker/`, `tests/`,
`node_modules/`). Xong sẽ có URL `https://<tên>.pages.dev` — cài PWA từ đó
trên điện thoại và máy tính.

> Từ giờ không cần `open-focus-board.bat`/localhost cho việc dùng đa thiết bị.

## C. Bật đồng bộ trong app (mỗi thiết bị)

1. Mở app (bản `.pages.dev`).
2. Bấm **Đồng bộ thiết bị**.
3. Dán **URL Worker** rồi **SYNC_TOKEN** (đúng y như đã đặt ở bước A).
4. Lặp lại trên thiết bị kia với **cùng URL và token**.

Sau đó app tự kéo khi mở / khi quay lại tab, và tự đẩy sau mỗi thay đổi.
Trạng thái hiện cạnh nút (“Đã đồng bộ ✓” / “Lỗi đồng bộ”). Bấm nút để đồng
bộ ngay; **giữ Shift + bấm** để đổi URL/token.

URL và token chỉ nằm trong `localStorage` của thiết bị, **không bao giờ vào
git**. Đổi token = đặt lại secret ở bước A rồi nhập lại trên các máy.

## Khắc phục sự cố

- **“Lỗi đồng bộ”**: sai URL/token, hoặc Worker chưa deploy. Shift+bấm để
  nhập lại; mở URL Worker trên trình duyệt — phải trả về 401 (đúng) chứ
  không phải lỗi mạng.
- **Mất dữ liệu cục bộ trên iPhone**: bình thường (Safari có thể xóa
  storage). Mở lại app, nó kéo lại từ server.
- Vẫn nên thỉnh thoảng **Xuất dữ liệu** ra file làm backup phụ.
