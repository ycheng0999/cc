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
    $.error("响应 JSON 解析失败：" + e);
    return $.done({});
  }

  try {
    const utils = await loadUtils($);
    const CryptoJS = utils.createCryptoJS();
    if (!CryptoJS) throw new Error("CryptoJS 加载失败");

    const candidates = ["address", "port", "mask_host", "path", "web_url"];
    const result = body?.result;
    if (!result || typeof result !== "object") throw new Error("未找到 result 字段");

    let outputs = [];

    for (const field of candidates) {
      const encrypted = result?.[field];
      if (typeof encrypted === "string" && isProbablyEncrypted(encrypted)) {
        const base64Str = decodeURIComponent(encrypted);
        for (const { key, iv } of KEYS) {
          try {
            const k = CryptoJS.enc.Utf8.parse(key);
            const i = CryptoJS.enc.Utf8.parse(iv);
            const decrypted = AES_Decrypt(base64Str, k, i, CryptoJS);
            if (decrypted?.trim()) {
              outputs.push(`${field}: ${decrypted}`);
              break; // 当前字段已成功解密，跳出 key 尝试循环
            }
          } catch (e) {
            $.log(`字段 ${field} 使用 key=${key} 解密失败`);
          }
        }
      }
    }

    if (outputs.length) {
      $.msg($.name, "✅ 多字段解密成功", outputs.join("\n"));
    } else {
      throw new Error("所有字段解密失败");
    }

  } catch (err) {
    $.logErr("❌ 出错", err);
    $.msg($.name, "解密失败", err.message);
  } finally {
    $.done({});
  }

  function isProbablyEncrypted(str) {
    return /^[A-Za-z0-9+/=]{16,}$/.test(str) || /^[\w\-]+\.[\w\-]+\.[\w\-]+$/.test(str);
  }

  function AES_Decrypt(data, key, iv, CryptoJS) {
    const decrypted = CryptoJS.AES.decrypt(data, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  async function loadUtils($) {
    const cached = $.getdata("Utils_Code");
    if (cached) { eval(cached); return creatUtils(); }
    const script = await $.get("https://cdn.jsdelivr.net/gh/xzxxn777/Surge@main/Utils/Utils.js");
    $.setdata(script, "Utils_Code");
    eval(script);
    return creatUtils();
  }

  async function loadEnv() {
    const cached = $persistentStore.read("Eric_Env_Code");
    if (cached) { eval(cached); return Env; }
    const script = await getCompatible("https://raw.githubusercontent.com/ycheng0999/cc/refs/heads/Y/evn.js");
    $persistentStore.write(script, "Eric_Env_Code");
    eval(script);
    return Env;
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
