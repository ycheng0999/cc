(async () => {
  const KEYS = [
    { key: "TmPrPhkOf8by0cvx", iv: "TmPrPhkOf8by0cvx" },
    { key: "929af8c0ac9dc557", iv: "929af8c0ac9dc557" },
    { key: "817a7baa5c74b982", iv: "817a7baa5c74b982" },
    { key: "5841b418488e65cc", iv: "5841b418488e65cc" },
    { key: "AE0plfOrl4CCUO87", iv: "AE0plfOrl4CCUO87" },
    { key: "VNfo9MuDNeP8ZjYm", iv: "VNfo9MuDNeP8ZjYm" }
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

  if (!CryptoJS) return $.done($.msg("CryptoJS 加载失败"));

  const decodedSet = new Set();
  let nodes = [];

  // 从对象中提取所有可能字段
  const fields = ["address", "port", "path", "node_id", "mask_host", "host"];
  const candidates = collectEncryptedStrings(body, fields);

  for (const enc of candidates) {
    const raw = decodeURIComponent(enc);
    for (const { key, iv } of KEYS) {
      try {
        const k = CryptoJS.enc.Utf8.parse(key);
        const i = CryptoJS.enc.Utf8.parse(iv);
        const decrypted = AES_Decrypt(raw, k, i, CryptoJS).trim();

        if (isValidDomain(decrypted) && !decodedSet.has(decrypted)) {
          decodedSet.add(decrypted);

          const config = `香港 = vmess, ${decrypted}, 443, username=${genUUID()}, ws=true, ws-path=/, tls=true, skip-cert-verify=true, sni=${decrypted}`;
          $.log(`✅ 解密完成 + vmess ✅配置生成\n${config}`);
          nodes.push(config);
          break; // 一个加密字段解开就跳出，避免重复尝试
        }
      } catch (err) {
        $.log(`尝试 key=${key} 解密失败：${err.message}`);
      }
    }
  }

  if (nodes.length === 0) {
    $.msg($.name, "未能解密任何有效配置");
  }

  $.done({});

  function AES_Decrypt(data, key, iv, CryptoJS) {
    const decrypted = CryptoJS.AES.decrypt(data, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  function isValidDomain(str) {
    return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(str);
  }

  function genUUID() {
    const hex = [...Array(36)].map((_, i) =>
      [8, 13, 18, 23].includes(i) ? "-" : Math.floor(Math.random() * 16).toString(16)
    );
    hex[14] = "4";
    hex[19] = (parseInt(hex[19], 16) & 0x3 | 0x8).toString(16);
    return hex.join("");
  }

  function collectEncryptedStrings(obj, keys = [], depth = 0) {
    if (depth > 8 || obj == null) return [];
    let results = [];

    if (typeof obj === "object") {
      if (Array.isArray(obj)) {
        for (const item of obj) {
          results = results.concat(collectEncryptedStrings(item, keys, depth + 1));
        }
      } else {
        for (const k in obj) {
          if (keys.includes(k) && typeof obj[k] === "string" && isProbablyEncrypted(obj[k])) {
            results.push(obj[k]);
          } else {
            results = results.concat(collectEncryptedStrings(obj[k], keys, depth + 1));
          }
        }
      }
    }
    return results;
  }

  function isProbablyEncrypted(str) {
    return /^[A-Za-z0-9+/=]{20,}$/.test(str) || /^[\w\-]+\.[\w\-]+\.[\w\-]+$/.test(str);
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
