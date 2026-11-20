// 导出：把当前 SVG 序列化为 SVG / PNG（按输出分辨率放大），不含编辑辅助元素
export function serializeCleanSvg(svgEl) {
  const clone = svgEl.cloneNode(true);
  clone.querySelectorAll("[data-ui]").forEach((n) => n.remove());
  clone.removeAttribute("class");
  clone.removeAttribute("style");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const vb = svgEl.viewBox.baseVal;
  clone.setAttribute("width", vb.width);
  clone.setAttribute("height", vb.height);
  return new XMLSerializer().serializeToString(clone);
}

const download = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export function exportSvg(svgEl, filename) {
  const text = `<?xml version="1.0" encoding="UTF-8"?>\n${serializeCleanSvg(svgEl)}`;
  download(new Blob([text], { type: "image/svg+xml;charset=utf-8" }), filename);
}

export function renderPngBlob(svgEl, dpi = 300) {
  const vb = svgEl.viewBox.baseVal;
  const scale = Math.max(0.72, Math.min(6, dpi / 100));
  if (vb.width * scale > 16384 || vb.height * scale > 16384 || vb.width * vb.height * scale * scale > 64000000) {
    return Promise.reject(new Error("导出图片尺寸过大，请降低 DPI、减少项目或改用 SVG 导出"));
  }
  const text = serializeCleanSvg(svgEl);
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vb.width * scale);
      canvas.height = Math.round(vb.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG 生成失败"))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片渲染失败，请重试"));
    };
    img.src = url;
  });
}

export async function exportPng(svgEl, filename, dpi) {
  const blob = await renderPngBlob(svgEl, dpi);
  download(blob, filename);
  return blob;
}

export async function copyPng(svgEl, dpi) {
  const blob = await renderPngBlob(svgEl, Math.min(dpi, 200));
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export const safeFilename = (text) => (String(text || "OP桥图").replace(/[\\/:*?"<>|\n\r]+/g, "_").trim() || "OP桥图");