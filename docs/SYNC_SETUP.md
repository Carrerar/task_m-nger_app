# Đồng bộ nhiều thiết bị — mỗi người một bảng riêng

Focus Board lưu toàn bộ dữ liệu trong trình duyệt. Để dùng chung dữ liệu
giữa các thiết bị, ta host bản web tĩnh + một Cloudflare Worker nhỏ giữ
snapshot JSON. Tất cả **miễn phí** ở mức dùng cá nhân/nhóm nhỏ.

**Mô hình danh tính (cho vài người dùng cụ thể):**

- Một **SYNC_TOKEN chung** cho cả nhóm — đây là *cổng chặn lạm dụng* Worker
  từ Internet. Mọi người nhập token này giống nhau.
- Mỗi người tự đặt một **Mã phòng riêng** (chuỗi dài, ngẫu nhiên). Worker
  tách dữ liệu theo mã phòng (mỗi phòng một key KV `state:<mã phòng>`), nên
  người này **không thấy** bảng của người kia. Mã phòng chính là *khóa* của
  bảng riêng — ai có token chung **và đoán trúng** mã phòng của bạn mới đọc
  được, vì vậy hãy đặt mã phòng dài và khó đoán.

Mô hình dữ liệu trong mỗi phòng: server giữ `{ rev, updatedAt, data }`. Mỗi
lần ghi `rev` tăng. Máy nào mở app sẽ kéo về nếu server mới hơn; thay đổi cục
bộ được đẩy lên (gộp lại, đẩy sau ~4 giây). **Last-write-wins** trong phạm vi
một phòng.

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

Đặt mã bí mật chung (chuỗi ngẫu nhiên dài — cổng chặn lạm dụng Worker;
**không commit**; chỉ chia cho những người trong nhóm bạn tin tưởng, mỗi
người vẫn có bảng riêng nhờ mã phòng ở bước C):

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
3. Nhập 3 thứ:
   - **URL Worker** và **SYNC_TOKEN** — đúng như bước A (cả nhóm giống nhau).
   - **Mã phòng riêng của bạn** — chuỗi dài, ngẫu nhiên do *bạn* tự chọn (ví
     dụ tạo bằng `node -e "console.log(require('crypto').randomBytes(18).toString('hex'))"`).
     Đây là khóa bảng riêng của bạn.
4. Trên **các thiết bị khác của chính bạn**: nhập **cùng URL, cùng token, và
   cùng mã phòng** → chúng dùng chung một bảng.
5. **Người khác** trong nhóm: cùng URL + token, nhưng **mã phòng khác của họ**
   → họ có bảng riêng, không thấy dữ liệu của bạn.

Quy tắc mã phòng: 6–128 ký tự, chỉ chữ/số và `. _ -`.

Sau đó app tự kéo khi mở / khi quay lại tab, và tự đẩy sau mỗi thay đổi.
Trạng thái hiện cạnh nút (“Đã đồng bộ ✓” / “Lỗi đồng bộ”). Bấm nút để đồng
bộ ngay; **giữ Shift + bấm** để đổi URL/token/mã phòng.

URL, token và mã phòng chỉ nằm trong `localStorage` của thiết bị, **không bao
giờ vào git**. Đổi token = đặt lại secret ở bước A rồi nhập lại trên các máy.

> **Di trú từ bản một-người-dùng cũ:** dữ liệu cũ trên server (key
> `focus-board-state`) trở thành mồ côi (vô hại, có thể xóa sau bằng
> `npx wrangler kv key delete --binding=STATE focus-board-state`). Bạn
> **không mất dữ liệu**: thiết bị đang giữ dữ liệu thật trong trình duyệt, khi
> đồng bộ lần đầu vào mã phòng mới (đang rỗng) sẽ tự **đẩy dữ liệu lên**. Chỉ
> cần đảm bảo thiết bị có dữ liệu đồng bộ *trước* các thiết bị trống.

## Khắc phục sự cố

- **“Lỗi đồng bộ”**: sai URL/token/mã phòng, hoặc Worker chưa deploy.
  Shift+bấm để nhập lại; mở URL Worker trên trình duyệt — phải trả về 401
  (đúng) chứ không phải lỗi mạng. Nếu mã phòng sai định dạng (ngắn quá hoặc
  có ký tự lạ), Worker trả `400 bad-room`.
- **Mở app thấy trống dù người khác có dữ liệu**: bình thường — bạn đang ở
  *mã phòng của mình*, không phải của họ. Mỗi người một bảng riêng theo mã
  phòng. Hai thiết bị muốn chung bảng phải nhập **giống hệt** mã phòng.
- **Mất dữ liệu cục bộ trên iPhone**: bình thường (Safari có thể xóa
  storage). Mở lại app, nó kéo lại từ server.
- Vẫn nên thỉnh thoảng **Xuất dữ liệu** ra file làm backup phụ.
