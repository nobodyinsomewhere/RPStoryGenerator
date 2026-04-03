window.CardImportService = (() => {
  const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  function readU32BE(arr, offset) {
    return (
      (arr[offset] << 24) |
      (arr[offset + 1] << 16) |
      (arr[offset + 2] << 8) |
      arr[offset + 3]
    ) >>> 0;
  }

  function equalSig(bytes) {
    if (bytes.length < 8) return false;
    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== PNG_SIG[i]) return false;
    }
    return true;
  }

  function parseChunks(bytes) {
    if (!equalSig(bytes)) throw new Error("不是合法 PNG 文件");
    const chunks = [];
    let offset = 8;

    while (offset < bytes.length) {
      const length = readU32BE(bytes, offset);
      const type = Utils.uint8ToText(bytes.slice(offset + 4, offset + 8));
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      const crcEnd = dataEnd + 4;

      chunks.push({
        type,
        data: bytes.slice(dataStart, dataEnd)
      });

      offset = crcEnd;
      if (type === "IEND") break;
    }

    return chunks;
  }

  function extractTextChunks(pngBytes) {
    const chunks = parseChunks(pngBytes);
    const out = [];

    for (const chunk of chunks) {
      if (chunk.type === "tEXt") {
        const zeroIndex = chunk.data.indexOf(0);
        if (zeroIndex > -1) {
          const keyword = Utils.uint8ToText(chunk.data.slice(0, zeroIndex));
          const text = Utils.uint8ToText(chunk.data.slice(zeroIndex + 1));
          out.push({ keyword, text });
        }
      }
    }

    return out;
  }

  function extractCharacterJsonFromPngBytes(bytes) {
    const texts = extractTextChunks(bytes);
    const hit =
      texts.find(x => x.keyword === "chara") ||
      texts.find(x => x.keyword === "character") ||
      texts.find(x => x.keyword === "ccv2");

    if (!hit) return null;
    return Utils.safeJsonParse(hit.text, null);
  }

  function normalizeCardObject(obj) {
    const data = obj?.data || obj || {};

    const name = data.name || "";
    const description = data.description || "";
    const personality = data.personality || "";
    const scenario = data.scenario || "";
    const creatorNotes = data.creator_notes || "";
    const summary = data.extensions?.summary || "";

    const mergedSummary = [
      summary,
      description,
      personality,
      scenario,
      creatorNotes
    ].filter(Boolean).join("\n");

    return {
      name,
      summary: mergedSummary.trim(),
      raw: obj
    };
  }

  async function importJsonFile(file) {
    const text = await Utils.fileToText(file);
    const parsed = Utils.safeJsonParse(text, null);
    if (!parsed) {
      throw new Error("JSON 解析失败");
    }
    return normalizeCardObject(parsed);
  }

  async function importPngFile(file) {
    const buf = await Utils.fileToArrayBuffer(file);
    const bytes = new Uint8Array(buf);
    const parsed = extractCharacterJsonFromPngBytes(bytes);

    if (!parsed) {
      throw new Error("PNG 中没有找到角色卡数据");
    }

    return normalizeCardObject(parsed);
  }

  async function importCardFile(file) {
    const name = file.name.toLowerCase();

    if (name.endsWith(".json")) {
      return await importJsonFile(file);
    }

    if (name.endsWith(".png")) {
      return await importPngFile(file);
    }

    if (file.type === "application/json") {
      return await importJsonFile(file);
    }

    if (file.type === "image/png") {
      return await importPngFile(file);
    }

    throw new Error("暂不支持该文件类型");
  }

  return {
    importCardFile
  };
})();