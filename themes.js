window.ThemeService = (() => {
  const STORAGE_KEY = "rp_trigger_theme";

  const themes = [
    { value: "glass-pink", label: "樱雾" },
    { value: "glass-purple", label: "夜鸢" },
    { value: "glass-sky", label: "晴空" },
    { value: "glass-amber", label: "琥珀" },
    { value: "glass-crimson", label: "绯雾" },
    { value: "glass-teal", label: "青岚" }
  ];

  function getSavedTheme() {
    return localStorage.getItem(STORAGE_KEY) || "glass-pink";
  }

  function saveTheme(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    saveTheme(theme);
  }

  function initThemeSelect() {
    const select = Utils.$("themeSelect");
    if (!select) return;

    select.innerHTML = themes.map(theme => {
      return `<option value="${theme.value}">${theme.label}</option>`;
    }).join("");

    const current = getSavedTheme();
    applyTheme(current);
    select.value = current;

    select.addEventListener("change", () => {
      applyTheme(select.value);
      Utils.toast(`主题已切换：${themes.find(t => t.value === select.value)?.label || select.value}`);
    });
  }

  function getThemes() {
    return themes;
  }

  return {
    initThemeSelect,
    applyTheme,
    getThemes,
    getSavedTheme
  };
})();