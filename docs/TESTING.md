# Kiểm thử (tests)

Bộ test dùng **`node:test`** có sẵn trong Node — **không cần cài thêm gói** nào
(`npm install` không bắt buộc, dự án không có dependency runtime).

## Chạy test

```bash
npm test
```

hoặc trực tiếp:

```bash
node --test tests/
```

## Phạm vi hiện tại

Test tập trung vào các module **thuần** (không đụng DOM), trong `tests/`:

| File | Module được test | Nội dung |
|------|------------------|----------|
| `tests/time.test.js`      | `js/core/time.js`      | định dạng ngày/giờ, `addDays`, `startOfWeek`, `secondsToClock`… |
| `tests/utils.test.js`     | `js/core/utils.js`     | `escapeHtml`, chuẩn hóa loại công việc, `createId` |
| `tests/selectors.test.js` | `js/core/selectors.js` | nhãn trạng thái, mức khẩn, lệch lịch, điểm hiệu quả |

`selectors.test.js` nạp `store.js` (đọc `localStorage` lúc import) nên có cài
một stub `localStorage` trong bộ nhớ để kết quả ổn định trên mọi bản Node.

## Lưu ý khi viết thêm test

- **Không** assert dấu phân tách của `Intl` (vd `formatDateShort` ra `17/05`
  ở Chrome nhưng `17-05` ở ICU của Node) — chỉ assert phần số.
- Module có side-effect DOM (`render`, `train`, `composer`…) cần tách phần
  logic thuần ra trước khi test (kế hoạch ở các giai đoạn sau).
