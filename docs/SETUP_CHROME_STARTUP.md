# Chạy Focus Board

Từ bản này, Focus Board dùng **ES modules + service worker (PWA)**. Trình duyệt
chặn hai thứ này khi mở trực tiếp bằng `file://`, nên app phải chạy qua một
local server (`http://localhost`). File `open-focus-board.bat` đã lo việc đó.

## Mở app

Bấm đúp:

```text
open-focus-board.bat
```

Script sẽ:

1. Bật một local server ngay trong thư mục này (ưu tiên Python `py`/`python`,
   nếu không có thì dùng Node với `serve.mjs`).
2. Mở Chrome ở chế độ app tới `http://localhost:4173/index.html`.

Cần cài sẵn **Python** (python.org) hoặc **Node** (nodejs.org). Máy này đã có cả hai.

Đổi cổng: sửa biến `PORT` trong `open-focus-board.bat` (và đặt biến môi trường
`PORT` nếu dùng nhánh Node).

## Cài như một app (khuyến nghị)

Khi đã mở bằng localhost:

1. Trong Chrome, mở menu ⋮ → **Cast, save, and share** → **Install page as app…**
   (hoặc icon cài đặt trên thanh địa chỉ).
2. Focus Board sẽ có cửa sổ riêng, icon riêng, và **chạy offline** nhờ service
   worker đã cache toàn bộ app shell.

## Tự mở khi bật máy

Vì cần server, không nên đặt thẳng `file://` vào trang khởi động Chrome nữa.
Thay vào đó cho `open-focus-board.bat` chạy lúc đăng nhập Windows:

1. Nhấn `Win + R`, gõ `shell:startup`, Enter.
2. Tạo shortcut trỏ tới `open-focus-board.bat` trong thư mục Startup vừa mở.

Mỗi lần đăng nhập Windows, server bật và Focus Board tự mở.

## Cập nhật service worker

`sw.js` cache theo phiên bản (biến `CACHE`, hiện là `focus-board-v11`). Khi
sửa code, tăng số phiên bản trong `sw.js` (ví dụ `v11` → `v12`) để client nạp
bản mới; cache cũ sẽ tự bị xóa ở lần kích hoạt kế tiếp. Khi thêm file tĩnh
mới (ảnh, module JS…) nhớ thêm đường dẫn vào mảng `APP_SHELL` để bản offline
có file đó.
