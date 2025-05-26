(async () => {
  const ENV_URL = "https://raw.githubusercontent.com/ycheng0999/cc/refs/heads/Y/evn.js";
  const KEY = "TmPrPhkOf8by0cvx"; // 可替换
  const IV = "TmPrPhkOf8by0cvx";  // 可替换

  const Env = await loadEnv();
  const $ = new Env("VPN节点提取器", { logLevel: "info" });

  let body = $response?.body || "";
  try { if (typeof body === "string") body = JSON.parse(body); } 
  catch (e) { $.error("响应解析失败：" + e); $.done({}); return; }

  const tryPaths = [
    ["result", "web_url"],
    ["bio_result_tron", 0, "bio_link_url_tron"],
    ["prd_result_flg", "prd_kf_link_flg"]
  ];

  try {
    const utils = await loadUtils($);
    const CryptoJS = utils.createCryptoJS();
    if (!CryptoJS) throw new Error("CryptoJS 加载失败");

    const key = CryptoJS.enc.Utf8.parse(KEY);
    const iv = CryptoJS.enc.Utf8.parse(IV);

    let encrypted;
    for (const path of tryPaths) {
      encrypted = getByPath(body, path);
      if (typeof encrypted === "string") break;
    }

    if (!encrypted) throw new Error("未找到有效的加密链接字段");
    const base64Url = decodeURIComponent(encrypted);
    const decryptedUrl = AES_Decrypt(base64Url, key, iv, CryptoJS);

    if (!decryptedUrl?.trim()) throw new Error("解密结果为空");
    $.msg($.name, "✅ 解密成功", decryptedUrl);
  } catch (e) {
    $.logErr("❌ 出错: ", e);
    $.msg($.name, "解密失败", e.message);
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
        iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
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

      const script = await getCompatible(ENV_URL);
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