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

    const result = body?.result;
    if (!result || typeof result !== "object") throw new Error("未找到 result 字段");

    const nodeName = result?.name || "节点";

    const fieldsToDecrypt = {
      address: "",
      port: "",
      path: "",
      node_id: "",
      url: ""  // 整体解密字段
    };

    const overallFields = new Set(['url']);

    let failed = false;
    let overallDecryptedConfig = null;

    function isProbablyEncrypted(str) {
      return /^[A-Za-z0-9+/=]+$/.test(str) && str.length >= 16;
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
        return null;
      }
    }

    function decryptField(val) {
      if (typeof val !== "string" || !isProbablyEncrypted(val)) {
        $.log(`跳过非加密字符串: ${val}`);
        return null;
      }
      try {
        const base64Str = decodeURIComponent(val);
        for (const { key, iv } of KEYS) {
          try {
            const k = CryptoJS.enc.Utf8.parse(key);
            const i = CryptoJS.enc.Utf8.parse(iv);
            const decrypted = AES_Decrypt(base64Str, k, i, CryptoJS);
            if (decrypted?.trim()) {
              $.log(`解密成功，key=${key}`);
              return decrypted;
            }
          } catch (e) {}
        }
      } catch (e) {
        $.log("解密异常：" + e);
      }
      return null;
    }

    for (const field in fieldsToDecrypt) {
      const raw = result[field];
      if (!raw) {
        $.log(`字段 ${field} 为空或不存在`);
        continue;
      }
      let decrypted = null;
      if (overallFields.has(field)) {
        decrypted = decryptField(raw);
        if (decrypted) overallDecryptedConfig = decrypted;
      } else {
        decrypted = decryptField(raw);
        if (decrypted) {
          fieldsToDecrypt[field] = decrypted;
        }
      }
      if (!decrypted && !overallDecryptedConfig) {
        $.log(`字段 ${field} 解密失败: ${raw}`);
        failed = true;
      }
    }

    if (overallDecryptedConfig) {
      $.msg("✅ 整体解密成功", "", overallDecryptedConfig);
      $.log("整体配置:\n" + overallDecryptedConfig);
      return $.done({});
    }

    if (failed) throw new Error("部分字段解密失败");

    // 生成 vmess 配置字符串
    const vmess = `${nodeName} = vmess, ${fieldsToDecrypt.address}, ${fieldsToDecrypt.port}, username=${fieldsToDecrypt.node_id}, ws=true, ws-path=${fieldsToDecrypt.path}, tls=true, skip-cert-verify=true, sni=${fieldsToDecrypt.address}`;
    $.msg("✅ 解密完成 + vmess 配置生成", "", vmess);
    $.log("配置：\n" + vmess);

  } catch (err) {
    $.logErr("❌ 出错", err);
    $.msg($.name, "配置生成失败", err.message);
  } finally {
    $.done({});
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
        $httpClient.get(url, (err, resp, data) => err ? reject(err) : resolve(data));
      } else if (typeof $task !== "undefined") {
        $task.fetch({ url }).then(resp => resolve(resp.body), reject);
      } else {
        reject("不支持的运行环境");
      }
    });
  }
})();
