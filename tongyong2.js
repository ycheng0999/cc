(async () => {
  const KEY = "817a7baa5c74b982"; // 替换为你的 Key
  const IV = "817a7baa5c74b982";  // 替换为你的 IV

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
    const key = CryptoJS.enc.Utf8.parse(KEY);
    const iv = CryptoJS.enc.Utf8.parse(IV);

    const encrypted = findEncryptedString(body);
    if (!encrypted) throw new Error("未找到加密链接字段");

    const urlEncoded = decodeURIComponent(encrypted);
    const decrypted = AES_Decrypt(urlEncoded, key, iv, CryptoJS);

    if (!decrypted?.trim()) throw new Error("解密内容为空");

    $.msg($.name, "✅ 解密成功", decrypted);
  } catch (err) {
    $.logErr("❌ 出错:", err);
    $.msg($.name, "解密失败", err.message);
  } finally {
    $.done({});
  }

  // 自动遍历对象找出第一个可能是 JWT 或 Base64 字符串
  function findEncryptedString(obj, depth = 0) {
    if (depth > 5) return null;
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

  function isProbablyEncrypted(str) {
    return typeof str === "string" && (
      /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(str) || // JWT
      /^[A-Za-z0-9+/=]{20,}$/.test(str) // Base64
    );
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
      if (cached) {
        eval(cached);
        return creatUtils();
      }
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
      if (cached) {
        eval(cached);
        return Env;
      }
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
