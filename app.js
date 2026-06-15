(() => {
  const focusOptions = [
    "情绪铺垫",
    "台词张力",
    "身体接触递进",
    "边界感",
    "主导权变化",
    "安全感",
    "禁忌感",
    "事后余波"
  ];

  const PROVIDERS_KEY = "rp_trigger_api_providers_v1";

  const state = {
    focus: [],
    lastResult: null,
    models: []
  };

  function getEl(id) {
    return Utils.$(id);
  }

  function getRelationValue() {
    const selectVal = getEl("relationSelect").value;
    if (selectVal === "custom") {
      return getEl("customRelation").value.trim() || "自定义关系";
    }
    return selectVal;
  }

  function collectInput() {
    return {
      charName: getEl("charName").value.trim(),
      userName: getEl("userName").value.trim(),
      charSummary: getEl("charSummary").value.trim(),
      worldNpc: getEl("worldNpc").value.trim(),
      relation: getRelationValue(),
      scene: getEl("sceneSelect").value,
      direction: getEl("directionSelect").value,
      tone: getEl("toneSelect").value,
      focus: [...state.focus],
      extraPrompt: getEl("extraPrompt").value.trim()
    };
  }

  function collectApiConfig() {
    return {
      name: getEl("providerName")?.value.trim() || "",
      baseUrl: getEl("apiBase").value.trim(),
      apiKey: getEl("apiKey").value.trim(),
      model: getEl("apiModel").value.trim()
    };
  }

  function humanizeError(err) {
    const text = err?.message || String(err || "未知错误");
    if (/401|unauthorized|invalid api key|incorrect api key/i.test(text)) return "Key 可能无效或无权限：" + text;
    if (/404|model.*not.*found|does not exist|模型不存在/i.test(text)) return "模型可能不存在或模型名填错：" + text;
    if (/400|bad_request|bad response status/i.test(text)) return "供应商返回 400：常见是 Base URL 层级、模型映射、请求格式或上游通道异常。" + text;
    if (/json|不是合法 JSON|Unexpected token/i.test(text)) return "返回不是 JSON：供应商可能返回了 HTML/错误页，或模型没有按要求输出 JSON。" + text;
    if (/Failed to fetch|NetworkError|CORS/i.test(text)) return "网络或 CORS 失败：浏览器可能无法直连该供应商，建议走可跨域的 OpenAI-compatible 网关。" + text;
    return text;
  }

  function loadProviders() {
    const parsed = Utils.safeJsonParse(localStorage.getItem(PROVIDERS_KEY), []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function saveProviders(list) {
    localStorage.setItem(PROVIDERS_KEY, JSON.stringify(list.slice(0, 12)));
  }

  function renderRecentProviders() {
    const select = getEl("recentProviderSelect");
    if (!select) return;
    const providers = loadProviders();
    select.innerHTML = '<option value="">选择最近配置...</option>' + providers.map((item, index) => `<option value="${index}">${escapeHtml(item.name || item.model || item.baseUrl || "未命名供应商")}</option>`).join("");
  }

  function saveProviderConfig() {
    const config = collectApiConfig();
    if (!config.baseUrl || !config.model) {
      setModelFetchStatus("至少填写 Base URL 和模型名后再保存。", "warn");
      return;
    }
    const providers = loadProviders().filter(item => !(item.baseUrl === config.baseUrl && item.model === config.model));
    providers.unshift({ ...config, savedAt: Date.now() });
    saveProviders(providers);
    renderRecentProviders();
    setModelFetchStatus("已保存到最近供应商。", "ok");
    Utils.toast("供应商配置已保存");
  }

  function applyProvider(index) {
    const item = loadProviders()[Number(index)];
    if (!item) return;
    getEl("providerName").value = item.name || "";
    getEl("apiBase").value = item.baseUrl || "";
    getEl("apiKey").value = item.apiKey || "";
    getEl("apiModel").value = item.model || "";
    saveCurrentInput();
    setModelFetchStatus("已载入最近供应商，可直接测试连接或拉模型。", "ok");
  }

  function normalizeModelsPayload(data) {
    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
        ? data.models
        : Array.isArray(data)
          ? data
          : [];
    return [
      ...new Set(
        list
          .map(item => typeof item === "string" ? item : item?.id || item?.name || item?.model)
          .filter(Boolean)
      )
    ].sort();
  }

  function setModelFetchStatus(text, kind = "") {
    const el = getEl("modelFetchStatus");
    el.textContent = text;
    el.dataset.kind = kind;
  }

  function escapeHtml(text) {
    return String(text || "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
  }

  function renderModelOptions(models, filter = "") {
    state.models = models.length ? models : state.models;
    const source = models.length ? models : state.models;
    const keyword = filter.trim().toLowerCase();
    const visible = keyword ? source.filter(model => model.toLowerCase().includes(keyword)) : source;
    const select = getEl("apiModelSelect");
    const search = getEl("modelSearch");
    select.innerHTML = '<option value="">选择拉取到的模型...</option>' + visible.map(model => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join("");
    select.classList.toggle("hidden", !source.length);
    search?.classList.toggle("hidden", !source.length);
    if (source.length) setModelFetchStatus(`显示 ${visible.length}/${source.length} 个模型。`, visible.length ? "ok" : "warn");
  }

  async function handleFetchModels() {
    const config = collectApiConfig();
    const btn = getEl("fetchModelsBtn");
    btn.disabled = true;
    btn.textContent = "拉取中...";
    setModelFetchStatus(`正在请求 ${ApiService.modelListUrl(config.baseUrl)} ...`);
    try {
      const data = await ApiService.fetchModels(config);
      const models = normalizeModelsPayload(data);
      renderModelOptions(models);
      if (models.length && !getEl("apiModel").value.trim()) {
        getEl("apiModel").value = models[0];
      }
      setModelFetchStatus(
        models.length
          ? `已拉取 ${models.length} 个模型；请优先从列表里选择，能避免 400。`
          : "请求成功，但没有解析到模型 ID。",
        models.length ? "ok" : "warn"
      );
      saveCurrentInput();
    } catch (err) {
      renderModelOptions([]);
      setModelFetchStatus(humanizeError(err), "bad");
    } finally {
      btn.disabled = false;
      btn.textContent = "拉模型";
    }
  }

  async function handleTestApi() {
    const btn = getEl("testApiBtn");
    btn.disabled = true;
    btn.textContent = "测试中...";
    setModelFetchStatus("正在测试 chat/completions ...");
    try {
      const result = await ApiService.testConnection(collectApiConfig());
      setModelFetchStatus(`连接成功：${result.slice(0, 80)}`, "ok");
      Utils.toast("API 连接正常");
    } catch (err) {
      setModelFetchStatus(humanizeError(err), "bad");
    } finally {
      btn.disabled = false;
      btn.textContent = "测试连接";
    }
  }

  function saveCurrentInput() {
    const data = {
      ...collectInput(),
      relationSelect: getEl("relationSelect").value,
      customRelation: getEl("customRelation").value.trim(),
      providerName: getEl("providerName")?.value.trim() || "",
      apiBase: getEl("apiBase").value.trim(),
      apiKey: getEl("apiKey").value.trim(),
      apiModel: getEl("apiModel").value.trim(),
      mode: getEl("modeSelect").value
    };
    StorageService.saveInput(data);
  }

  function fillInput(data) {
    if (!data) return;

    getEl("charName").value = data.charName || "";
    getEl("userName").value = data.userName || "";
    getEl("charSummary").value = data.charSummary || "";
    getEl("worldNpc").value = data.worldNpc || "";
    getEl("relationSelect").value = data.relationSelect || "陌生人";
    getEl("customRelation").value = data.customRelation || "";
    getEl("sceneSelect").value = data.scene || "雨夜共处";
    getEl("directionSelect").value = data.direction || "普通剧情";
    getEl("toneSelect").value = data.tone || "偏女性向情绪推进";
    getEl("extraPrompt").value = data.extraPrompt || "";
    getEl("providerName").value = data.providerName || "";
    getEl("apiBase").value = data.apiBase || "";
    getEl("apiKey").value = data.apiKey || "";
    getEl("apiModel").value = data.apiModel || "";
    getEl("modeSelect").value = data.mode || "template";

    updateCustomRelationVisibility();
  }

  function clearInputFields() {
    getEl("charName").value = "";
    getEl("userName").value = "";
    getEl("charSummary").value = "";
    getEl("worldNpc").value = "";
    getEl("relationSelect").value = "陌生人";
    getEl("customRelation").value = "";
    getEl("sceneSelect").value = "雨夜共处";
    getEl("directionSelect").value = "普通剧情";
    getEl("toneSelect").value = "偏女性向情绪推进";
    getEl("extraPrompt").value = "";
    getEl("providerName").value = "";
    getEl("apiBase").value = "";
    getEl("apiKey").value = "";
    getEl("apiModel").value = "";
    getEl("modeSelect").value = "template";
    renderModelOptions([]);
    renderRecentProviders();
    setModelFetchStatus("可填域名根路径、`/v1`，或完整 `.../chat/completions`；点“拉模型”先验证。", "");
    state.focus = [];
    StorageService.saveFocus([]);
    renderFocusChips();
    updateCustomRelationVisibility();
  }

  function updateCustomRelationVisibility() {
    const wrap = getEl("customRelationWrap");
    const isCustom = getEl("relationSelect").value === "custom";
    wrap.classList.toggle("hidden", !isCustom);
  }

  function renderFocusChips() {
    const wrap = getEl("focusChips");
    wrap.innerHTML = focusOptions.map(item => `
      <div class="chip ${state.focus.includes(item) ? "active" : ""}" data-focus="${item}">
        ${item}
      </div>
    `).join("");

    [...wrap.querySelectorAll("[data-focus]")].forEach(el => {
      el.addEventListener("click", () => {
        const value = el.dataset.focus;
        if (state.focus.includes(value)) {
          state.focus = state.focus.filter(x => x !== value);
        } else {
          state.focus.push(value);
        }
        StorageService.saveFocus(state.focus);
        renderFocusChips();
      });
    });
  }

  function renderResult(result) {
    getEl("hookOut").textContent = result.hook || "";
    getEl("summaryOut").textContent = result.summary || "";
    getEl("beatOut").textContent = result.beat || "";
    getEl("openingOut").textContent = result.opening || "";
    state.lastResult = result;
  }

  function pick(arr) {
    return Utils.pick(arr);
  }

  function buildTemplateResult(input) {
    const charName = input.charName || "{{char}}";
    const userName = input.userName || "{{user}}";
    const relation = input.relation || "陌生人";
    const scene = input.scene || "雨夜共处";
    const direction = input.direction || "普通剧情";
    const tone = input.tone || "偏女性向情绪推进";
    const summary = input.charSummary || `${charName}是一个有自己秘密、边界与情绪克制的人。`;
    const worldNpc = input.worldNpc || "未补充世界观或其他 NPC。";
    const focus = input.focus.length ? input.focus.join("、") : "情绪变化与关系张力";
    const extra = input.extraPrompt || "无额外要求";

    const hookPool = [
      `在${scene}中，${charName}与你以“${relation}”的身份被迫靠近，而真正失控的也许并不只是局势。`,
      `原本只是一次普通的${scene}相遇，但${charName}显然不打算让这段关系继续停留在表面。`,
      `你以为${scene}只会带来短暂交集，直到${charName}第一次在你面前露出本不该被看见的一面。`,
      `当“${relation}”被迫进入${scene}这种过于靠近的处境时，任何一句话都可能成为新的导火索。`
    ];

    const beatPool = [
      `- ${charName}表面依旧克制，却在关键时刻没有推开${userName}\n- 某个原本不该提起的旧事被重新碰触\n- 一次身体上的靠近打破了还能维持的距离\n- 这件事结束后，你们的关系已经无法回到原点`,
      `- ${charName}嘴上否认，却在行动上默许了靠近\n- 局势要求你们暂时合作，但情绪并不合作\n- 一句带刺的话比预想中更接近真心\n- 其中一方先越界，另一方却没有立刻退开`,
      `- 表面目标只是解决眼前问题，真正危险的是气氛开始变质\n- ${charName}在某个瞬间暴露了脆弱或欲言又止\n- 一次停顿过久的对视让沉默变得更难收场\n- 接下来任何选择都会推动关系发生偏移`
    ];

    const openingPool = [
`${scene}的空气安静得有些过分。\n\n${charName}抬眼看向你，神情依旧克制，像是什么都没有发生。\n可你知道，不是。\n\n“你要是现在走，我不会拦你。”\n他/她顿了顿，语气却并不像真的无所谓。\n\n“但要是留下来——”\n后半句没有说完，可那一点停顿，已经足够让人心烦意乱。`,

`${userName}原本只想把事情处理完就离开。\n可${charName}在${scene}里看向你的那一眼，让一切都变得没那么简单。\n\n“别摆出那种表情。”\n他/她低声开口，像是不耐，又像是某种更难说清的情绪。\n\n“我现在最不需要的，就是你突然心软。”`,

`门关上的那一瞬间，外面的声音像是被彻底隔开。\n\n${charName}站得并不远，却也没有真正靠近。\n那种若即若离的距离，反而比任何触碰都更折磨人。\n\n“你应该知道，”\n他/她看着你，语气很轻，轻得反而危险，\n\n“今晚最麻烦的，未必是眼前这件事。”`
    ];

    const summaryText =
`角色信息：
- 角色名：${charName}
- 玩家称呼：${userName}
- 设定摘要：${summary}

世界观 / 其他 NPC：
${worldNpc}

剧情输入：
- 关系类型：${relation}
- 场景类型：${scene}
- 剧情方向：${direction}
- 体验倾向：${tone}
- 关注重点：${focus}
- 补充要求：${extra}`;

    return {
      hook: pick(hookPool),
      summary: summaryText,
      beat: pick(beatPool),
      opening: pick(openingPool)
    };
  }

  async function handleGenerate() {
    const input = collectInput();
    const mode = getEl("modeSelect").value;

    Utils.setStatus(mode === "ai" ? "AI 生成中..." : "生成中...");

    try {
      let result;
      if (mode === "ai") {
        const config = collectApiConfig();
        result = await ApiService.generateWithAI(input, config);
      } else {
        result = buildTemplateResult(input);
      }

      renderResult(result);
      Utils.setStatus("已生成");
      Utils.toast("生成完成");
    } catch (err) {
      console.error(err);
      Utils.setStatus("生成失败");
      setModelFetchStatus(humanizeError(err), "bad");
      Utils.toast("生成失败，查看 API 设置提示")
    }
  }

  async function handleImportCard(file) {
    const result = await CardImportService.importCardFile(file);
    getEl("charName").value = result.name || "";
    getEl("charSummary").value = result.summary || "";
    if (result.worldNpc) {
      getEl("worldNpc").value = result.worldNpc;
    }
    Utils.toast("角色卡已导入");
    Utils.setStatus("角色卡已导入");
  }

  function handleSaveInput() {
    saveCurrentInput();
    Utils.toast("输入已保存到本地");
    Utils.setStatus("输入已保存");
  }

  function handleClearInput() {
    clearInputFields();
    StorageService.clearInput();
    Utils.toast("输入已清空");
    Utils.setStatus("输入已清空");
  }

  async function handleCopyAll() {
    if (!state.lastResult) {
      Utils.toast("请先生成内容");
      return;
    }
    await Utils.copyText(Utils.fullResultText(state.lastResult));
    Utils.toast("已复制全部内容");
  }

  function handleExportTxt() {
    if (!state.lastResult) {
      Utils.toast("请先生成内容");
      return;
    }
    const filename = Utils.sanitizeFilename((getEl("charName").value || "rp-trigger") + ".txt");
    Utils.downloadText(filename, Utils.fullResultText(state.lastResult));
    Utils.toast("TXT 已导出");
  }

  function handleExportJson() {
    if (!state.lastResult) {
      Utils.toast("请先生成内容");
      return;
    }
    const filename = Utils.sanitizeFilename((getEl("charName").value || "rp-trigger") + ".json");
    Utils.downloadJson(filename, {
      input: collectInput(),
      result: state.lastResult,
      exportedAt: new Date().toISOString(),
      generator: "RP剧情触发器 V2"
    });
    Utils.toast("JSON 已导出");
  }

  function handleSaveFav() {
    if (!state.lastResult) {
      Utils.toast("请先生成内容");
      return;
    }

    const titleName = getEl("charName").value.trim() || "未命名角色";
    StorageService.addFav({
      id: Utils.uid("fav"),
      title: `${titleName} · 剧情收藏`,
      time: Utils.nowText(),
      text: Utils.fullResultText(state.lastResult)
    });

    renderFavs();
    Utils.toast("已收藏当前结果");
  }

  function renderFavs() {
    const list = StorageService.loadFavs();
    const wrap = getEl("favList");

    if (!list.length) {
      wrap.innerHTML = `
        <div class="fav-item">
          <div class="meta">暂无收藏。</div>
        </div>
      `;
      return;
    }

    wrap.innerHTML = list.map(item => `
      <div class="fav-item">
        <div class="title">${item.title}</div>
        <div class="meta">${item.time}</div>
        <div class="text">${item.text}</div>
        <div class="mini-actions">
          <button class="secondary" data-fav-copy="${item.id}">复制</button>
          <button class="danger" data-fav-del="${item.id}">删除</button>
        </div>
      </div>
    `).join("");

    [...wrap.querySelectorAll("[data-fav-copy]")].forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.favCopy;
        const item = StorageService.loadFavs().find(x => x.id === id);
        if (!item) return;
        await Utils.copyText(item.text);
        Utils.toast("已复制收藏内容");
      });
    });

    [...wrap.querySelectorAll("[data-fav-del]")].forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.favDel;
        StorageService.deleteFav(id);
        renderFavs();
        Utils.toast("已删除收藏");
      });
    });
  }

  function bindCopyButtons() {
    [...document.querySelectorAll(".copy-btn")].forEach(btn => {
      btn.addEventListener("click", async () => {
        const targetId = btn.dataset.copyTarget;
        const target = getEl(targetId);
        if (!target) return;
        const text = target.textContent.trim();
        if (!text || text === "还没有生成内容。") {
          Utils.toast("请先生成内容");
          return;
        }
        await Utils.copyText(text);
        Utils.toast("已复制");
      });
    });
  }

  function bindInputTabs() {
    const tabs = [...document.querySelectorAll(".input-tab")];
    const panels = [...document.querySelectorAll(".input-tab-panel")];
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        const key = tab.dataset.inputTab;
        tabs.forEach(item => item.classList.toggle("active", item === tab));
        panels.forEach(panel => panel.classList.toggle("active", panel.dataset.inputPanel === key));
      });
    });
  }

  function bindOutputTabs() {
    const tabs = [...document.querySelectorAll(".output-tab")];
    const panels = [...document.querySelectorAll(".output-tab-panel")];
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        const key = tab.dataset.outputTab;
        tabs.forEach(item => item.classList.toggle("active", item === tab));
        panels.forEach(panel => panel.classList.toggle("active", panel.dataset.outputPanel === key));
      });
    });
  }

  function openApiModal() {
    const modal = getEl("apiModal");
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    setTimeout(() => getEl("apiBase")?.focus(), 0);
  }

  function closeApiModal() {
    const modal = getEl("apiModal");
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  }

  function bindApiModal() {
    getEl("openApiSettingsBtn").addEventListener("click", openApiModal);
    getEl("closeApiSettingsBtn").addEventListener("click", closeApiModal);
    getEl("closeApiSettingsFooterBtn").addEventListener("click", closeApiModal);
    getEl("saveProviderBtn").addEventListener("click", saveProviderConfig);
    getEl("recentProviderSelect").addEventListener("change", () => applyProvider(getEl("recentProviderSelect").value));
    getEl("modelSearch").addEventListener("input", () => renderModelOptions([], getEl("modelSearch").value));
    getEl("fetchModelsBtn").addEventListener("click", () => {
      handleFetchModels().catch(err => {
        setModelFetchStatus(humanizeError(err), "bad");
      });
    });
    getEl("testApiBtn").addEventListener("click", () => {
      handleTestApi().catch(err => {
        setModelFetchStatus(humanizeError(err), "bad");
      });
    });
    getEl("apiModelSelect").addEventListener("change", () => {
      const value = getEl("apiModelSelect").value;
      if (value) getEl("apiModel").value = value;
      saveCurrentInput();
    });
    getEl("apiModal").addEventListener("click", event => {
      if (event.target === getEl("apiModal")) closeApiModal();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && getEl("apiModal").classList.contains("show")) closeApiModal();
    });
  }

  function bindEvents() {
    bindInputTabs();
    bindOutputTabs();
    bindApiModal();

    getEl("relationSelect").addEventListener("change", updateCustomRelationVisibility);

    getEl("cardFileInput").addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await handleImportCard(file);
      } catch (err) {
        setModelFetchStatus(humanizeError(err), "bad");
      Utils.toast("生成失败，查看 API 设置提示")
        Utils.setStatus("导入失败");
      }
      e.target.value = "";
    });

    [
      "charName",
      "userName",
      "charSummary",
      "worldNpc",
      "relationSelect",
      "customRelation",
      "sceneSelect",
      "directionSelect",
      "toneSelect",
      "extraPrompt",
      "providerName",
      "apiBase",
      "apiKey",
      "apiModel",
      "modeSelect"
    ].forEach(id => {
      getEl(id)?.addEventListener("change", saveCurrentInput);
      getEl(id)?.addEventListener("input", () => {
        if (["charSummary", "worldNpc", "extraPrompt", "customRelation", "apiBase", "apiKey", "apiModel", "charName", "userName"].includes(id)) {
          saveCurrentInput();
        }
      });
    });

    getEl("generateBtn").addEventListener("click", handleGenerate);
    getEl("rerollBtn").addEventListener("click", handleGenerate);
    getEl("saveInputBtn").addEventListener("click", handleSaveInput);
    getEl("clearInputBtn").addEventListener("click", handleClearInput);
    getEl("copyAllBtn").addEventListener("click", handleCopyAll);
    getEl("exportTxtBtn").addEventListener("click", handleExportTxt);
    getEl("exportJsonBtn").addEventListener("click", handleExportJson);
    getEl("saveFavBtn").addEventListener("click", handleSaveFav);

    bindCopyButtons();
  }

  function init() {
    ThemeService.initThemeSelect();
    state.focus = StorageService.loadFocus();
    renderFocusChips();

    const savedInput = StorageService.loadInput();
    if (savedInput) {
      fillInput(savedInput);
    } else {
      updateCustomRelationVisibility();
    }

    renderModelOptions([]);
    renderRecentProviders();
    setModelFetchStatus("可填域名根路径、`/v1`，或完整 `.../chat/completions`；点“拉模型”先验证。", "");
    bindEvents();
    renderFavs();
    Utils.setStatus("就绪");
  }

  init();
})();
