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

    const paths = [
      ["result", "web_url"],
      ["bio_result_tron", 0, "bio_link_url_tron"],
      ["prd_result_flg", "prd_kf_link_flg"]
    ];

    let encrypted = null;
    let matchedPath = null;

    for (const path of paths) {
      encrypted = getByPath(body, path);
      if (typeof encrypted === "string" && isProbablyEncrypted(encrypted)) {
        matchedPath = path;
        break;
      }
    }

    if (!encrypted) {
      $.log("未通过路径匹配到字段，开始递归查找...");
      encrypted = findEncryptedString(body);
    }

    if (!encrypted) throw new Error("未找到加密链接字段");

    const base64Url = decodeURIComponent(encrypted);
    let decrypted = "";

    for (const { key, iv } of KEYS) {
      try {
        const k = CryptoJS.enc.Utf8.parse(key);
        const i = CryptoJS.enc.Utf8.parse(iv);
        decrypted = AES_Decrypt(base64Url, k, i, CryptoJS);
        if (decrypted?.trim()) {
          // 检查是否为域名型内容，自动生成 vmess 节点
          if (/^[\w.-]+\.[\w.-]+$/.test(decrypted.trim()) && !decrypted.trim().startsWith("vmess://")) {
            const vmessNode = {
              v: "2",
              ps: decrypted.trim(),
              add: decrypted.trim(),
              port: "443",
              id: "00000000-0000-0000-0000-000000000000",
              aid: "0",
              net: "tcp",
              type: "none",
              host: "",
              path: "",
              tls: "tls"
            };
            const encoded = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(JSON.stringify(vmessNode)));
            const vmessLink = "vmess://" + encoded;
            $.msg($.name, "✅ 解密成功 (转换为 vmess)", vmessLink);
            return $.done({});
          }

          $.msg($.name, "✅ 解密成功", decrypted);
          return $.done({});
        }
      } catch (err) {
        $.log(`尝试 key=${key} 解密失败：${err.message}`);
      }
    }

    throw new Error("所有 key/iv 解密失败");

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
