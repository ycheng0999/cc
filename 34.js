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
    $.error("响应 JSON 解析失败：" + e.message);
    return $.done({});
  }

  try {
    const utils = await loadUtils($);
    const CryptoJS = utils.createCryptoJS();
    if (!CryptoJS) throw new Error("CryptoJS 加载失败");

    // 多路径配置，方便适配不同接口
    const FIELD_PATHS = {
      address: ["result.address", "result.data.address", "result.node.address"],
      port: ["result.port", "result.data.port", "result.node.port"],
      path: ["result.path", "result.data.path", "result.node.path"],
      node_id: ["result.node_id", "result.data.node_id", "result.node.node_id"],
      name: ["result.name", "result.data.name", "result.node.name"]
    };

    // 读取字段值（多路径依次尝试）
    function getFieldValue(obj, paths) {
      for (const path of paths) {
        const val = path.split('.').reduce((acc, k) => acc && acc[k], obj);
        if (typeof val === "string" && val.trim()) return val.trim();
      }
      return null;
    }

    // 解密函数
    const decryptField = (val) => {
      if (typeof val !== "string") return val;
      if (!isProbablyEncrypted(val)) return val;
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
          if (decrypted && decrypted.trim()) return decrypted.trim();
        } catch {}
      }
      return null;
    };

    // 先取节点名
    const nodeNameRaw = getFieldValue(body, FIELD_PATHS.name) || "节点";
    const nodeName = decryptField(nodeNameRaw) || nodeNameRaw;

    // 解密所有字段
    const fieldsToDecrypt = {};
    let failedFields = [];

    for (const field of ["address", "port", "path", "node_id"]) {
      const raw = getFieldValue(body, FIELD_PATHS[field]);
      if (!raw) {
        $.log(`字段 ${field} 不存在或非字符串，跳过`);
        failedFields.push(field);
        fieldsToDecrypt[field] = "";
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
      $.log(`以下字段解密失败或不存在: ${failedFields.join(", ")}`);
    }

    // 生成 vmess 配置
    const vmess = `${nodeName} = vmess, ${fieldsToDecrypt.address}, ${fieldsToDecrypt.port}, username=${fieldsToDecrypt.node_id}, ws=true, ws-path=${fieldsToDecrypt.path || "/"}, tls=true, skip-cert-verify=true, sni=${fieldsToDecrypt.address}`;
    $.msg("✅ 解密完成 + vmess ✅配置生成", "", vmess);
    $.log("配置内容：\n" + vmess);

  } catch (err) {
    $.logErr("❌ 出错", err.stack || err);
    $.msg($.name, "配置生成失败", err.message);
  } finally {
    $.done({});
  }

  function isProbablyEncrypted(str) {
    try {
      const decoded = decodeURIComponent(str);
      return /^[A-Za-z0-9+/=]+$/.test(decoded);
    } catch {
      return false;
    }
  }

  function AES_Decrypt(data, key, iv, CryptoJS) {
    const encrypted = CryptoJS.enc.Base64.parse(data);
    const encryptedBase64Str = CryptoJS.enc.Base64.stringify(encrypted);
    const decrypted = CryptoJS.AES.decrypt(encryptedBase64Str, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
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
