window.ApiService = (() => {
  async function chatCompletion({ baseUrl, apiKey, model, messages }) {
    const url = baseUrl.replace(/\/+$/, "") + "/chat/completions";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        temperature: 0.95,
        messages
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API 请求失败：${res.status} ${text}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "";
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
          content: "你是一个 RP 剧情触发器写作助手。"
        },
        {
          role: "user",
          content: buildPrompt(input)
        }
      ]
    });

    const parsed = Utils.safeJsonParse(content, null);
    if (!parsed) {
      throw new Error("AI 返回内容不是合法 JSON");
    }

    return {
      hook: parsed.hook || "",
      summary: parsed.summary || "",
      beat: parsed.beat || "",
      opening: parsed.opening || ""
    };
  }

  return {
    generateWithAI
  };
})();