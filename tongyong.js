(async () => {
  const KEY = "TmPrPhkOf8by0cvx"; // 可替换
  const IV = "TmPrPhkOf8by0cvx";  // 可替换

  const ENV_URL = "https://raw.githubusercontent.com/ycheng0999/cc/refs/heads/Y/evn.js";
  const Env = await loadEnv();
  const $ = new Env("VPN节点提取器", { logLevel: "info" });

  let body = $response?.body || "";
  try {
    if (typeof body === "string") body = JSON.parse(body);
  } catch (e) {
    $.error("响应解析失败：" + e);
    $.done({});
    return;
  }

  try {
    const utils = await loadUtils($);
    const CryptoJS = utils.createCryptoJS();
    if (!CryptoJS) throw new Error("CryptoJS 加载失败");

    const key = CryptoJS.enc.Utf8.parse(KEY);
    const iv = CryptoJS.enc.Utf8.parse(IV);

    const candidates = findPossibleEncryptedStrings(body);
    if (candidates.length === 0) throw new Error("未找到可能的加密链接");

    let decryptedUrl = null;
    for (const item of candidates) {
      const base64Url = decodeURIComponent(item);
      try {
        decryptedUrl = AES_Decrypt(base64Url, key, iv, CryptoJS);
        if (decryptedUrl?.trim()) break;
      } catch {}
    }

    if (!decryptedUrl?.trim()) throw new Error("所有字段解密失败");

    $.msg($.name, "✅ 解密成功", decryptedUrl);
  } catch (e) {
    $.logErr("❌ 出错: ", e);
    $.msg($.name, "解密失败", e.message);
  } finally {
    $.done({});
  }

  function findPossibleEncryptedStrings(obj) {
    const results = [];
    const traverse = (o) => {
      if (typeof o === "object" && o !== null) {
        for (const key in o) traverse(o[key]);
      } else if (typeof o === "string") {
        if (isPossiblyBase64(o) || isJWT(o)) results.push(o);
      }
    };
    traverse(obj);
    return results;
  }

  function isPossiblyBase64(str) {
    return /^[A-Za-z0-9+/=]{16,}$/.test(str) && str.length % 4 === 0;
  }

  function isJWT(str) {
    return /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(str);
  }

  function AES_Decrypt(data, key, iv, CryptoJS) {
    const decrypted = CryptoJS.AES.decrypt(data, key, {
      iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
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

    const script = await getCompatible(ENV_URL);
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