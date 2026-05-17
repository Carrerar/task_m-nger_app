import { state, replaceData } from "../core/store.js";
import { ui } from "../core/ui-state.js";
import { saveAndRender } from "../core/bus.js";
import { todayKey } from "../core/time.js";

export function exportData() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `focus-board-backup-${todayKey()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function importData(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    let parsed;
    try {
      parsed = JSON.parse(String(reader.result));
    } catch {
      window.alert("File không đọc được — không phải JSON hợp lệ.");
      return;
    }
    if (!parsed || !Array.isArray(parsed.tasks)) {
      window.alert("File không đúng định dạng Focus Board (thiếu danh sách tasks).");
      return;
    }
    if (!window.confirm(`Nhập ${parsed.tasks.length} task sẽ ghi đè toàn bộ dữ liệu hiện tại. Tiếp tục?`)) {
      return;
    }
    replaceData(parsed);
    ui.editingTaskId = null;
    ui.selectedCategory = "all";
    saveAndRender();
    window.alert("Đã nhập dữ liệu thành công.");
  });
  reader.readAsText(file);
}
