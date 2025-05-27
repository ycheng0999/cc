(async () => {
  const KEYS = [
    { key: "TmPrPhkOf8by0cvx", iv: "TmPrPhkOf8by0cvx" },
    { key: "929af8c0ac9dc557", iv: "929af8c0ac9dc557" },
    { key: "817a7baa5c74b982", iv: "817a7baa5c74b982" },
    { key: "5841b418488e65cc", iv: "5841b418488e65cc" },
    { key: "AE0plfOrl4CCUO87", iv: "AE0plfOrl4CCUO87" },
    { key: "VNfo9MuDNeP8ZjYm", iv: "VNfo9MuDNeP8ZjYm" },
  ];

  function fixKeyIv(str) {
    if (str.length === 16) return str;
    if (str.length === 8) return str + str;
    return str.padEnd(16, "0");
  }

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

    const overallPaths = [
      ["result", "web_url"], // 整体字段示例
    ];
    const segmentedPaths = [
      ["result", "address"],
      ["result", "port"],
      ["result", "path"],
      ["result", "node_id"],
    ];

    let overallEncrypted = null;
    for (const path of overallPaths) {
      const candidate = getByPath(body, path);
      if (candidate && typeof candidate === "string") {
        overallEncrypted = candidate;
        break;
      }
    }

    if (overallEncrypted) {
      const base64Url = decodeURIComponent(overallEncrypted);
      $.log("尝试整体字段解密，原文:", overallEncrypted);
      for (const { key, iv } of KEYS) {
        try {
          const k = CryptoJS.enc.Utf8.parse(fixKeyIv(key));
          const i = CryptoJS.enc.Utf8.parse(fixKeyIv(iv));
          const decrypted = AES_Decrypt(base64Url, k, i, CryptoJS);
          $.log(`尝试 key=${key} iv=${iv} 解密结果:`, decrypted);
          if (decrypted?.trim()) {
            $.msg($.name, "整体字段解密成功", decrypted);
            return $.done({});
          }
        } catch (err) {
          $.log(`整体字段解密失败 key=${key} iv=${iv}:`, err.message);
        }
      }
    } else {
      $.log("没有整体字段可解密");
    }

    // 分段字段解密示例
    let decryptedParts = {};
    let allSuccess = true;
    for (const path of segmentedPaths) {
      const encryptedSegment = getByPath(body, path);
      if (!encryptedSegment) {
        allSuccess = false;
        $.log(`缺少分段字段 ${path.join(".")}`);
        break;
      }
      const base64Seg = decodeURIComponent(encryptedSegment);
      let segmentDecrypted = "";
      for (const { key, iv } of KEYS) {
        try {
          const k = CryptoJS.enc.Utf8.parse(fixKeyIv(key));
          const i = CryptoJS.enc.Utf8.parse(fixKeyIv(iv));
          segmentDecrypted = AES_Decrypt(base64Seg, k, i, CryptoJS);
          if (segmentDecrypted?.trim()) break;
        } catch {}
      }
      if (!segmentDecrypted) {
        allSuccess = false;
        $.log(`分段字段 ${path.join(".")} 解密失败`);
        break;
      }
      decryptedParts[path[path.length - 1]] = segmentDecrypted.trim();
    }

    if (allSuccess) {
      const vmessStr = `vmess, ${decryptedParts.address}, ${decryptedParts.port}, username=${decryptedParts.node_id}, ws-path=/${decryptedParts.path}, tls=true`;
      $.msg($.name, "分段字段解密成功", vmessStr);
    } else {
      throw new Error("分段字段解密失败");
    }
  } catch (err) {
    $.logErr("❌ 出错:", err);
    $.msg($.name, "解密失败", err.message);
  } finally {
    $.done({});
  }

  function getByPath(obj, path) {
    try {
      return path.reduce((acc, cur) => acc?.[cur], obj);
    } catch {
      return undefined;
    }
  }

  function AES_Decrypt(data, key, iv, CryptoJS) {
    try {
      const decrypted = CryptoJS.AES.decrypt(data, key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
      throw new Error("AES 解密失败: " + e.message);
    }
  }

  async function loadUtils($) {
    try {
      const cached = $.getdata("Utils_Code");
      if (cached) {
        eval(cached);
        return creatUtils();
      }
      const script = await $.get(
        "https://cdn.jsdelivr.net/gh/xzxxn777/Surge@main/Utils/Utils.js"
      );
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
      if (cached) {
        eval(cached);
        return Env;
      }
      const script = await getCompatible(
        "https://raw.githubusercontent.com/ycheng0999/cc/refs/heads/Y/evn.js"
      );
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
        $httpClient.get(url, (err, resp, data) =>
          err ? reject(err) : resolve(data)
        );
      } else if (typeof $task !== "undefined") {
        $task
          .fetch({ url })
          .then((resp) => resolve(resp.body), reject);
      } else {
        reject("不支持的运行环境");
      }
    });
  }
})();
