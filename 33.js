(async () => {
  const KEYS = [
    { key: "TmPrPhkOf8by0cvx", iv: "TmPrPhkOf8by0cvx" },
    { key: "929af8c0ac9dc557", iv: "929af8c0ac9dc557" },
    { key: "817a7baa5c74b982", iv: "817a7baa5c74b982" },
    { key: "5841b418488e65cc", iv: "5841b418488e65cc" },
    { key: "AE0plfOrl4CCUO87", iv: "AE0plfOrl4CCUO87" },
    { key: "VNfo9MuDNeP8ZjYm", iv: "VNfo9MuDNeP8ZjYm" }
  ];

  // 载入环境辅助类
  const Env = await loadEnv();
  const $ = new Env("VPN节点提取器", { logLevel: "info" });

  let body = $response?.body || "";
  try {
    if (typeof body === "string") body = JSON.parse(body);
  } catch (e) {
    $.error("响应 JSON 解析失败：" + e.message);
    return $.done({});
  }

  try {
    const utils = await loadUtils($);
    const CryptoJS = utils.createCryptoJS();
    if (!CryptoJS) throw new Error("CryptoJS 加载失败");

    const result = body?.result;
    if (!result || typeof result !== "object") throw new Error("未找到 result 字段");

    const nodeName = result?.name || "节点";

    // 待解密字段，默认空字符串
    const fieldsToDecrypt = {
      address: "",
      port: "",
      path: "",
      node_id: ""
    };

    // 解密函数，自动尝试多个 key/iv
    const decryptField = (val) => {
      if (typeof val !== "string") return val; // 非字符串不解密
      if (!isProbablyEncrypted(val)) return val; // 判断是否可能加密字符串

      let base64Str = "";
      try {
        base64Str = decodeURIComponent(val);
      } catch {
        base64Str = val;
      }

      for (const { key, iv } of KEYS) {
        try {
          const k = CryptoJS.enc.Utf8.parse(key);
          const i = CryptoJS.enc.Utf8.parse(iv);
          const decrypted = AES_Decrypt(base64Str, k, i, CryptoJS);
          if (decrypted && decrypted.trim()) {
            $.log(`字段解密成功，key=${key}`);
            return decrypted.trim();
          }
        } catch (e) {
          $.log(`key=${key} 解密异常: ${e.message}`);
        }
      }
      return null; // 全部尝试失败返回 null
    };

    // 遍历解密
    let failedFields = [];
    for (const field in fieldsToDecrypt) {
      const raw = result[field];
      if (typeof raw !== "string") {
        $.log(`字段 ${field} 不存在或非字符串，跳过`);
        continue;
      }
      const decrypted = decryptField(raw);
      if (!decrypted) {
        $.log(`字段 ${field} 解密失败`);
        failedFields.push(field);
        fieldsToDecrypt[field] = "";
      } else {
        fieldsToDecrypt[field] = decrypted;
      }
    }

    if (failedFields.length) {
      $.log(`以下字段解密失败: ${failedFields.join(", ")}`);
    }

    // 生成 vmess 配置（Surge 格式）
    const vmess = `${nodeName} = vmess, ${fieldsToDecrypt.address || ''}, ${fieldsToDecrypt.port || ''}, username=${fieldsToDecrypt.node_id || ''}, ws=true, ws-path=${fieldsToDecrypt.path || '/'}, tls=true, skip-cert-verify=true, sni=${fieldsToDecrypt.address || ''}`;
    $.msg("✅ 解密完成 + vmess ✅配置生成", "", vmess);
    $.log("配置内容：\n" + vmess);

  } catch (err) {
    $.logErr("❌ 出错", err.stack || err);
    $.msg($.name, "配置生成失败", err.message);
  } finally {
    $.done({});
  }

  // 判断是否可能是加密的 Base64 字符串
  function isProbablyEncrypted(str) {
    try {
      const decoded = decodeURIComponent(str);
      return /^[A-Za-z0-9+/=]+$/.test(decoded);
    } catch {
      return false;
    }
  }

  // AES-CBC 解密，data 是 base64 编码字符串
  function AES_Decrypt(data, key, iv, CryptoJS) {
    // CryptoJS.AES.decrypt 需要 CipherParams 对象或者 Base64 字符串
    // 这里确保 data 是 Base64 字符串
    const encrypted = CryptoJS.enc.Base64.parse(data);
    const encryptedBase64Str = CryptoJS.enc.Base64.stringify(encrypted);
    const decrypted = CryptoJS.AES.decrypt(encryptedBase64Str, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  // 加载辅助工具 (CryptoJS 等)
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

  // 加载环境辅助类
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

  // 兼容不同平台的网络请求函数
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
