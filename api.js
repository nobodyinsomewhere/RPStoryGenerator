window.ApiService = (() => {
  function normalizeEndpointBase(raw) {
    const base = String(raw || "").trim().replace(/\/+$/, "");
    if (!base) throw new Error("请先填写 Base URL");
    if (!/^https?:\/\//i.test(base)) throw new Error("Base URL 必须以 http:// 或 https:// 开头");
    return base.replace(/\/chat\/completions$/i, "");
  }

  function modelListUrl(baseUrl) {
    const base = normalizeEndpointBase(baseUrl);
    if (/\/v\d+$/i.test(base)) return base + "/models";
    return base + "/v1/models";
  }

  function chatCompletionUrl(baseUrl) {
    const base = String(baseUrl || "").trim().replace(/\/+$/, "");
    if (/\/chat\/completions$/i.test(base)) return base;
    if (/\/v\d+$/i.test(base)) return base + "/chat/completions";
    return base + "/v1/chat/completions";
  }

  function buildHeaders(apiKey) {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    };
  }

  async function readErrorText(res) {
    const text = await res.text();
    const parsed = Utils.safeJsonParse(text, null);
    const message = parsed?.error?.message || parsed?.message || text;
    const hint = res.status === 400
      ? "\n\n常见原因：Base URL 填错层级、模型名不存在、该模型不支持当前请求格式，或上游要求特殊参数。建议先点“拉模型/测试连接”，从拉到的列表里选模型。"
      : "";
    return `${res.status} ${message || res.statusText}${hint}`;
  }

  async function fetchModels({ baseUrl, apiKey }) {
    const res = await fetch(modelListUrl(baseUrl), {
      headers: buildHeaders(apiKey),
      cache: "no-store"
    });
    if (!res.ok) throw new Error(await readErrorText(res));
    return await res.json();
  }

  async function chatCompletion({ baseUrl, apiKey, model, messages }) {
    const url = chatCompletionUrl(baseUrl);
    const body = {
      model,
      temperature: 0.85,
      max_tokens: 1800,
      messages
    };

    const res = await fetch(url, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      throw new Error(`API 请求失败：${await readErrorText(res)}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
  }

  async function testConnection(config) {
    if (!config.baseUrl || !config.model) {
      throw new Error("请先填写 Base URL 和模型名");
    }
    const content = await chatCompletion({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      messages: [
        { role: "system", content: "你是连接测试助手。" },
        { role: "user", content: "只回复 OK" }
      ]
    });
    return content.trim() || "OK";
  }

  function buildPrompt(input) {
    return `
你是一个擅长 RP / 酒馆剧情辅助写作的助手。请根据用户输入，生成严格 JSON，字段必须为：

hook
summary
beat
opening

要求：
1. 输出语言为中文
2. 文风自然，可直接用于 RP / 酒馆开场
3. 更注重剧情逻辑、关系推进、情绪递进、角色一致性
4. 如果涉及暧昧 / 亲密 / 成人向剧情，不要只写刺激点，要写出为什么会发展到这一步、边界感、压抑感或拉扯感
5. 偏照顾女性向体验，避免单纯物化、工具化、低级刺激模板
6. hook 要短而有抓力
7. summary 要清晰概括当前局势
8. beat 要列出后续推进节点，最好使用条目形式
9. opening 要能直接作为开场白使用
10. 返回严格 JSON，不要 Markdown 代码块，不要额外解释

输入信息：
${JSON.stringify(input, null, 2)}
    `.trim();
  }

  function parseAiJson(content) {
    const direct = Utils.safeJsonParse(content, null);
    if (direct) return direct;
    const match = String(content || "").match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (match) return Utils.safeJsonParse(match[1], null);
    const start = String(content || "").indexOf("{");
    const end = String(content || "").lastIndexOf("}");
    if (start >= 0 && end > start) return Utils.safeJsonParse(String(content).slice(start, end + 1), null);
    return null;
  }

  async function generateWithAI(input, config) {
    if (!config.baseUrl || !config.model) {
      throw new Error("AI 模式下请填写 Base URL 和模型名");
    }

    const content = await chatCompletion({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      messages: [
        {
          role: "system",
          content: "你是一个 RP 剧情触发器写作助手。必须只输出合法 JSON。"
        },
        {
          role: "user",
          content: buildPrompt(input)
        }
      ]
    });

    const parsed = parseAiJson(content);
    if (!parsed) {
      throw new Error("AI 返回内容不是合法 JSON。可换更稳定的模型，或降低模型温度后重试。");
    }

    return {
      hook: parsed.hook || "",
      summary: parsed.summary || "",
      beat: Array.isArray(parsed.beat) ? parsed.beat.join("\n") : (parsed.beat || ""),
      opening: parsed.opening || ""
    };
  }

  return {
    fetchModels,
    generateWithAI,
    testConnection,
    modelListUrl,
    chatCompletionUrl
  };
})();