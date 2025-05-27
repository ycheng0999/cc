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

  const utils = await loadUtils($);
  const CryptoJS = utils.createCryptoJS();
  if (!CryptoJS) {
    $.msg($.name, "失败", "CryptoJS 加载失败");
    return $.done({});
  }

  // 工具函数
  function getByPath(obj, path) {
    try {
      return path.reduce((acc, cur) => acc?.[cur], obj);
    } catch {
      return undefined;
    }
  }

  function isProbablyEncrypted(str) {
    return /^[A-Za-z0-9+/=]{20,}$/.test(str) || /^[\w\-]+\.[\w\-]+\.[\w\-]+$/.test(str);
  }

  function AES_Decrypt(data, key, iv, CryptoJS) {
    try {
      const decrypted = CryptoJS.AES.decrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
      throw new Error("AES 解密失败: " + e.message);
    }
  }

  // 递归找加密字段（整体解密用）
  function findEncryptedString(obj, depth = 0) {
    if (depth > 6) return null;
    if (typeof obj === "string" && isProbablyEncrypted(obj)) return obj;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = findEncryptedString(item, depth + 1);
        if (result) return result;
      }
    } else if (typeof obj === "object" && obj !== null) {
      for (const key in obj) {
        const result = findEncryptedString(obj[key], depth + 1);
        if (result) return result;
      }
    }
    return null;
  }

  // 拼接 vmess 字符串（分段解密用）
  function buildVmessNodeString({
    name,
    address,
    port,
    uuid,
    ws = true,
    wsPath = "/",
    tls = true,
    skipCertVerify = true,
    sni
  }) {
    return `${name} = vmess, ${address}, ${port}, username=${uuid}, ws=${ws}, ws-path=${wsPath}, tls=${tls}, skip-cert-verify=${skipCertVerify}, sni=${sni || address}`;
  }

  // 整体解密的字段路径（你的整体路径示例）
  const overallPaths = [
    ["result", "web_url"],
    ["bio_result_tron", 0, "bio_link_url_tron"],
    ["prd_result_flg", "prd_kf_link_flg"]
  ];

  // 分段解密字段路径（示例，你需要根据你的实际json结构修改）
  const segmentedPaths = {
    name: ["data", "name"],
    address: ["data", "address"],
    port: ["data", "port"],
    uuid: ["data", "uuid"],
    wsPath: ["data", "ws_path"],
    sni: ["data", "sni"],
  };

  // 先尝试整体解密
  try {
    let encrypted = null;
    for (const path of overallPaths) {
      encrypted = getByPath(body, path);
      if (typeof encrypted === "string" && isProbablyEncrypted(encrypted)) {
        break;
      }
    }
    if (!encrypted) {
      // 如果整体路径没找到，加深度递归找
      encrypted = findEncryptedString(body);
    }
    if (!encrypted) throw new Error("整体字段未找到加密数据");

    const base64Url = decodeURIComponent(encrypted);
    let decrypted = "";
    for (const { key, iv } of KEYS) {
      try {
        const k = CryptoJS.enc.Utf8.parse(key);
        const i = CryptoJS.enc.Utf8.parse(iv);
        decrypted = AES_Decrypt(base64Url, k, i, CryptoJS);
        if (decrypted?.trim()) {
          $.msg($.name, "✅ 整体解密成功", decrypted);
          return $.done({});
        }
      } catch {}
    }
    throw new Error("整体解密失败，尝试分段解密");
  } catch {
    // 整体解密失败，继续尝试分段解密
  }

  // 分段解密
  try {
    // 取分段加密字段
    const encryptedFields = {};
    for (const key in segmentedPaths) {
      const val = getByPath(body, segmentedPaths[key]);
      if (!val) throw new Error(`分段缺少字段 ${key}`);
      encryptedFields[key] = val;
    }

    // 解密每个字段
    const decryptedFields = {};
    for (const [key, value] of Object.entries(encryptedFields)) {
      let decrypted = "";
      for (const { key: k, iv } of KEYS) {
        try {
          const kk = CryptoJS.enc.Utf8.parse(k);
          const ii = CryptoJS.enc.Utf8.parse(iv);
          decrypted = AES_Decrypt(decodeURIComponent(value), kk, ii, CryptoJS);
          if (decrypted?.trim()) break;
        } catch {}
      }
      if (!decrypted) throw new Error(`字段 ${key} 解密失败`);
      decryptedFields[key] = decrypted.trim();
    }

    // 组装 vmess 字符串
    const vmessString = buildVmessNodeString({
      name: decryptedFields.name || "未命名",
      address: decryptedFields.address,
      port: decryptedFields.port,
      uuid: decryptedFields.uuid,
      wsPath: decryptedFields.wsPath || "/",
      sni: decryptedFields.sni || decryptedFields.address
    });

    $.msg($.name, "✅ 分段解密成功", vmessString);
  } catch (err) {
    $.logErr("❌ 出错:", err);
    $.msg($.name, "解密失败", err.message);
  } finally {
    $.done({});
  }

  // 工具加载部分保持不变
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
