window.Utils = (() => {
  function $(id) {
    return document.getElementById(id);
  }

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }

  function nowText() {
    return new Date().toLocaleString();
  }

  function safeJsonParse(text, fallback = null) {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  function sanitizeFilename(name = "file") {
    return String(name).replace(/[\\/:*?"<>|]+/g, "_").trim() || "file";
  }

  function downloadText(filename, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function copyText(text) {
    await navigator.clipboard.writeText(text);
  }

  function fileToText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file, "utf-8");
    });
  }

  function fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function uint8ToText(uint8) {
    return new TextDecoder().decode(uint8);
  }

  function textToUint8(text) {
    return new TextEncoder().encode(text);
  }

  function setStatus(text) {
    const el = $("statusText");
    if (el) el.textContent = text;
  }

  function toast(message) {
    const wrap = $("toastWrap");
    if (!wrap) return;

    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    wrap.appendChild(el);

    requestAnimationFrame(() => {
      el.classList.add("show");
    });

    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 250);
    }, 2200);
  }

  function fullResultText(result) {
    if (!result) return "";
    return [
      "【一句话钩子】",
      result.hook || "",
      "",
      "【场景摘要】",
      result.summary || "",
      "",
      "【推进节点】",
      result.beat || "",
      "",
      "【开场白】",
      result.opening || ""
    ].join("\n");
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  return {
    $,
    uid,
    nowText,
    safeJsonParse,
    sanitizeFilename,
    downloadText,
    downloadJson,
    copyText,
    fileToText,
    fileToArrayBuffer,
    fileToDataURL,
    uint8ToText,
    textToUint8,
    setStatus,
    toast,
    fullResultText,
    pick
  };
})();