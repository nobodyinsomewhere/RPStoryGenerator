window.StorageService = (() => {
  const INPUT_KEY = "rp_trigger_input";
  const FAV_KEY = "rp_trigger_favs";
  const FOCUS_KEY = "rp_trigger_focus";

  function saveInput(data) {
    localStorage.setItem(INPUT_KEY, JSON.stringify(data));
  }

  function loadInput() {
    return Utils.safeJsonParse(localStorage.getItem(INPUT_KEY), null) || null;
  }

  function clearInput() {
    localStorage.removeItem(INPUT_KEY);
  }

  function saveFocus(list) {
    localStorage.setItem(FOCUS_KEY, JSON.stringify(list));
  }

  function loadFocus() {
    const parsed = Utils.safeJsonParse(localStorage.getItem(FOCUS_KEY), []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function loadFavs() {
    const parsed = Utils.safeJsonParse(localStorage.getItem(FAV_KEY), []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function saveFavs(list) {
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
  }

  function addFav(item) {
    const list = loadFavs();
    list.unshift(item);
    saveFavs(list);
    return list;
  }

  function deleteFav(id) {
    const list = loadFavs().filter(item => item.id !== id);
    saveFavs(list);
    return list;
  }

  return {
    saveInput,
    loadInput,
    clearInput,
    saveFocus,
    loadFocus,
    loadFavs,
    saveFavs,
    addFav,
    deleteFav
  };
})();