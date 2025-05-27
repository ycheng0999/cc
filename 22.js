(async () => {
  const KEYS = [
    { key: "TmPrPhkOf8by0cvx", iv: "TmPrPhkOf8by0cvx" },
    { key: "929af8c0ac9dc557", iv: "929af8c0ac9dc557" },
    { key: "817a7baa5c74b982", iv: "817a7baa5c74b982" },
    { key: "5841b418488e65cc", iv: "5841b418488e65cc" },
    { key: "AE0plfOrl4CCUO87", iv: "AE0plfOrl4CCUO87" },
    { key: "VNfo9MuDNeP8ZjYm", iv: "VNfo9MuDNeP8ZjYm" },
  ];

  const Env = await loadEnv();
  const $ = new Env("VPN节点提取器", { logLevel: "info" });

  let body = $response?.body || "";
  try {
    if (typeof body === "string") body = JSON.parse(body);
  } catch (e) {
    $.error("响应解析失败：" + e);
    return $.done({});
  }

  try {
    const utils = await loadUtils($);
    const CryptoJS = utils.createCryptoJS();
    if (!CryptoJS) throw new Error("CryptoJS 加载失败");

    // 分段字段路径示例，支持分段解密
    const segmentedPaths = [
      ["data", "address"],
      ["data", "port"],
      ["data", "path"],
      ["data", "node_id"],
    ];

    // 整体字段路径示例，支持整体解密
    const wholePaths = [
      ["result", "web_url"],
      ["bio_result_tron", 0, "bio_link_url_tron"],
      ["prd_result_flg", "prd_kf_link_flg"],
    ];

    // 辅助函数，按路径获取值
    function getByPath(obj, path) {
      try {
        return path.reduce((acc, cur) => acc?.[cur], obj);
      } catch {
        return undefined;
      }
    }

    // 判断字符串是否可能是加密串（Base64或JWT格式）
    function isProbablyEncrypted(str) {
      return /^[A-Za-z0-9+/=]{20,}$/.test(str) || /^[\w\-]+\.[\w\-]+\.[\w\-]+$/.test(str);
    }

    // AES-CBC解密
    function AES_Decrypt(data, key, iv, CryptoJS) {
      const decrypted = CryptoJS.AES.decrypt(data, key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      return decrypted.toString(CryptoJS.enc.Utf8);
    }

    // 递归查找加密字符串
    function findEncryptedString(obj, depth = 0) {
      if (depth > 6) return null;
      if (typeof obj === "string" && isProbablyEncrypted(obj)) return obj;

      if (Array.isArray(obj)) {
        for (const item of obj) {
          const found = findEncryptedString(item, depth + 1);
          if (found) return found;
        }
      } else if (typeof obj === "object" && obj !== null) {
        for (const key in obj) {
          const found = findEncryptedString(obj[key], depth + 1);
          if (found) return found;
        }
      }
      return null;
    }

    // 解密尝试函数，返回第一个成功解密的结果
    function tryDecrypt(encryptedStr) {
      if (!encryptedStr) return null;
      const base64Url = decodeURIComponent(encryptedStr);

      for (const { key, iv } of KEYS) {
        try {
          const k = CryptoJS.enc.Utf8.parse(key);
          const i = CryptoJS.enc.Utf8.parse(iv);
          const decrypted = AES_Decrypt(base64Url, k, i, CryptoJS);
          if (decrypted?.trim()) {
            $.log(`尝试 key=${key} 解密成功`);
            return decrypted;
          }
        } catch (e) {
          $.log(`尝试 key=${key} 解密失败: ${e.message}`);
        }
      }
      return null;
    }

    // 主逻辑：先分段尝试解密所有字段，再整体尝试
    // 分段解密尝试
    let segmentedResults = {};
    let segmentedSuccessCount = 0;
    for (const path of segmentedPaths) {
      const enc = getByPath(body, path);
      if (typeof enc === "string" && isProbablyEncrypted(enc)) {
        const dec = tryDecrypt(enc);
        if (dec) {
          segmentedResults[path.join(".")] = dec;
          segmentedSuccessCount++;
        } else {
          $.log(`字段 ${path.join(".")} 解密失败`);
        }
      } else {
        $.log(`字段 ${path.join(".")} 不存在或不符合加密格式`);
      }
    }

    if (segmentedSuccessCount === segmentedPaths.length) {
      // 全部分段字段都解密成功，输出结果
      $.msg($.name, "分段解密成功", JSON.stringify(segmentedResults, null, 2));
      return $.done({});
    }

    // 分段失败，尝试整体解密
    let encryptedWhole = null;
    let matchedWholePath = null;
    for (const path of wholePaths) {
      const enc = getByPath(body, path);
      if (typeof enc === "string" && isProbablyEncrypted(enc)) {
        encryptedWhole = enc;
        matchedWholePath = path;
        break;
      }
    }

    if (!encryptedWhole) {
      $.log("整体字段未匹配到加密字段，开始递归查找整体加密字段...");
      encryptedWhole = findEncryptedString(body);
      if (!encryptedWhole) throw new Error("未找到整体加密字段");
    }

    const wholeDecrypted = tryDecrypt(encryptedWhole);
    if (wholeDecrypted) {
      $.msg($.name, "整体解密成功", wholeDecrypted);
      return $.done({});
    }

    throw new Error("分段和整体解密全部失败");

  } catch (e) {
    $.logErr("❌ 出错:", e);
    $.msg($.name, "解密失败", e.message);
  } finally {
    $.done({});
  }

  // 依赖加载部分不变
  async function loadUtils($) {
    try {
      const cached = $.getdata("Utils_Code");
      if (cached) { eval(cached); return creatUtils(); }

      const script = await $.get("https://cdn.jsdelivr.net/gh/xzxxn777/Surge@main/Utils/Utils.js");
      $.setdata(script, "Utils_Code");
      eval(script);
      return creatUtils();
    } catch (e) {
      throw new Error("加载 Utils 失败: " + e.message);
    }
  }

  async function loadEnv() {
    try {
      const cached = $persistentStore.read("Eric_Env_Code");
      if (cached) { eval(cached); return Env; }

      const script = await getCompatible("https://raw.githubusercontent.com/ycheng0999/cc/refs/heads/Y/evn.js");
      $persistentStore.write(script, "Eric_Env_Code");
      eval(script);
      return Env;
    } catch (e) {
      throw new Error("加载 Env 失败: " + e.message);
    }
  }

  function getCompatible(url) {
    return new Promise((resolve, reject) => {
      if (typeof $httpClient !== "undefined") {
        $httpClient.get(url, (err, resp, data) => err ? reject(err) : resolve(data));
      } else if (typeof $task !== "undefined") {
        $task.fetch({ url }).then(resp => resolve(resp.body), reject);
      } else {
        reject("不支持的运行环境");
      }
    });
  }
})();
