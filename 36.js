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
    $.error("响应 JSON 解析失败：" + e);
    return $.done({});
  }

  try {
    const utils = await loadUtils($);
    const CryptoJS = utils.createCryptoJS();
    if (!CryptoJS) throw new Error("CryptoJS 加载失败");

    const result = body?.result || {};
    $.log("调试：result.url = " + result.url);

    let finalConfig = null;

    // 先尝试整体解密 result.url
    if (result.url && isProbablyEncryptedLooser(result.url)) {
      $.log("尝试整体解密 result.url");
      finalConfig = decryptUrl(result.url, CryptoJS);
      if (finalConfig) {
        $.msg("✅ 整体解密成功", "", finalConfig);
        $.log("配置（整体解密）:\n" + finalConfig);
      } else {
        $.log("整体解密 result.url 失败，准备尝试逐字段解密");
      }
    } else {
      $.log("result.url 不存在或格式不符合加密特征，跳过整体解密");
    }

    // 如果整体解密失败，尝试逐字段解密
    if (!finalConfig) {
      const nodeName = result.name || "节点";

      const fieldsToDecrypt = {
        address: "",
        port: "",
        path: "",
        node_id: ""
      };

      let failed = false;
      for (const field in fieldsToDecrypt) {
        const raw = result[field];
        $.log(`尝试解密字段 ${field}，原始值：${raw}`);
        const decrypted = decryptField(raw, CryptoJS);
        if (!decrypted) {
          $.log(`字段 ${field} 解密失败`);
          failed = true;
        } else {
          fieldsToDecrypt[field] = decrypted;
          $.log(`字段 ${field} 解密成功，值：${decrypted}`);
        }
      }

      if (!failed) {
        finalConfig = `${nodeName} = vmess, ${fieldsToDecrypt.address}, ${fieldsToDecrypt.port}, username=${fieldsToDecrypt.node_id}, ws=true, ws-path=${fieldsToDecrypt.path}, tls=true, skip-cert-verify=true, sni=${fieldsToDecrypt.address}`;
        $.msg("✅ 逐字段解密成功", "", finalConfig);
        $.log("配置（逐字段解密）:\n" + finalConfig);
      } else {
        throw new Error("部分字段解密失败");
      }
    }
  } catch (err) {
    $.logErr("❌ 出错", err);
    $.msg($.name, "配置生成失败", err.message);
  } finally {
    $.done({});
  }

  function isProbablyEncryptedLooser(str) {
    // 放宽判断，允许 urlencoded 的base64字符串
    if (typeof str !== "string") return false;
    const s = decodeURIComponent(str);
    // 判断至少16字符以上，且只含base64字符
    return /^[A-Za-z0-9+/=]{16,}$/.test(s);
  }

  function isProbablyEncrypted(str) {
    if (typeof str !== "string") return false;
    return /^[A-Za-z0-9+/=]{16,}$/.test(str);
  }

  function decryptUrl(encrypted, CryptoJS) {
    try {
      const base64Str = decodeURIComponent(encrypted);
      for (const { key, iv } of KEYS) {
        const k = CryptoJS.enc.Utf8.parse(key);
        const i = CryptoJS.enc.Utf8.parse(iv);
        const decrypted = CryptoJS.AES.decrypt(base64Str, k, {
          iv: i,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });
        const res = decrypted.toString(CryptoJS.enc.Utf8);
        if (res && res.trim()) return res;
      }
    } catch (e) {
      $.log("decryptUrl 发生异常：" + e);
    }
    return null;
  }

  function decryptField(val, CryptoJS) {
    if (typeof val !== "string" || !isProbablyEncrypted(val)) return val;
    try {
      const base64Str = decodeURIComponent(val);
      for (const { key, iv } of KEYS) {
        const k = CryptoJS.enc.Utf8.parse(key);
        const i = CryptoJS.enc.Utf8.parse(iv);
        const decrypted = CryptoJS.AES.decrypt(base64Str, k, {
          iv: i,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });
        const res = decrypted.toString(CryptoJS.enc.Utf8);
        if (res && res.trim()) return res;
      }
    } catch (e) {
      $.log("decryptField 发生异常：" + e);
    }
    return null;
  }

  async function loadUtils($) {
    const cached = $.getdata("Utils_Code");
    if (cached) {
      eval(cached);
      return creatUtils();
    }
    const script = await $.get("https://cdn.jsdelivr.net/gh/xzxxn777/Surge@main/Utils/Utils.js");
    $.setdata(script, "Utils_Code");
    eval(script);
    return creatUtils();
  }

  async function loadEnv() {
    const cached = $persistentStore.read("Eric_Env_Code");
    if (cached) {
      eval(cached);
      return Env;
    }
    const script = await getCompatible("https://raw.githubusercontent.com/ycheng0999/cc/refs/heads/Y/evn.js");
    $persistentStore.write(script, "Eric_Env_Code");
    eval(script);
    return Env;
  }

  function getCompatible(url) {
    return new Promise((resolve, reject) => {
      if (typeof $httpClient !== "undefined") {
        $httpClient.get(url, (err, resp, data) => (err ? reject(err) : resolve(data)));
      } else if (typeof $task !== "undefined") {
        $task.fetch({ url }).then((resp) => resolve(resp.body), reject);
      } else {
        reject("不支持的运行环境");
      }
    });
  }
})();
