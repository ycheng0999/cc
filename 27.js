(async () => {
  // AES 解密密钥和向量列表（你提供的）
  const KEYS = [
    { key: "TmPrPhkOf8by0cvx", iv: "TmPrPhkOf8by0cvx" },
    { key: "929af8c0ac9dc557", iv: "929af8c0ac9dc557" },
    { key: "817a7baa5c74b982", iv: "817a7baa5c74b982" },
    { key: "5841b418488e65cc", iv: "5841b418488e65cc" },
    { key: "AE0plfOrl4CCUO87", iv: "AE0plfOrl4CCUO87" },
    { key: "VNfo9MuDNeP8ZjYm", iv: "VNfo9MuDNeP8ZjYm" },
  ];

  // 环境加载和初始化
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
  if (!CryptoJS) {
    $.msg($.name, "失败", "CryptoJS 加载失败");
    return $.done({});
  }

  // 工具函数，取嵌套路径值
  function getByPath(obj, path) {
    try {
      return path.reduce((acc, cur) => acc?.[cur], obj);
    } catch {
      return undefined;
    }
  }

  // AES 解密函数
  function AES_Decrypt(data, key, iv, CryptoJS) {
    try {
      const decrypted = CryptoJS.AES.decrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
      return null;
    }
  }

  // 你给定的分段字段路径
  const segmentedPaths = {
    name: ["result", "name"],             // 明文，节点名
    address: ["result", "address"],       // 加密
    port: ["result", "port"],             // 加密
    uuid: ["result", "node_id"],          // 加密
    wsPath: ["result", "path"],           // 加密
    sni: ["result", "mask_host"],         // 加密
  };

  // 进行分段解密
  try {
    const name = getByPath(body, segmentedPaths.name) || "未命名";

    const fieldsToDecrypt = ["address", "port", "uuid", "wsPath", "sni"];
    const decryptedFields = {};

    for (const field of fieldsToDecrypt) {
      const encrypted = getByPath(body, segmentedPaths[field]);
      if (!encrypted) throw new Error(`缺少字段：${field}`);

      let decrypted = "";
      for (const { key, iv } of KEYS) {
        try {
          const k = CryptoJS.enc.Utf8.parse(key);
          const i = CryptoJS.enc.Utf8.parse(iv);
          decrypted = AES_Decrypt(decodeURIComponent(encrypted), k, i, CryptoJS);
          if (decrypted?.trim()) break;
        } catch {}
      }
      if (!decrypted) throw new Error(`字段${field}解密失败`);
      decryptedFields[field] = decrypted.trim();
    }

    // 固定参数
    const ws = true;
    const tls = true;
    const skipCertVerify = true;

    const sni = decryptedFields.sni || decryptedFields.address;

    // 组装 vmess 节点字符串，完全符合你示例格式
    const vmessStr = `${name} = vmess, ${decryptedFields.address}, ${decryptedFields.port}, username=${decryptedFields.uuid}, ws=${ws}, ws-path=${decryptedFields.wsPath || "/"}, tls=${tls}, skip-cert-verify=${skipCertVerify}, sni=${sni}`;

    $.msg($.name, "✅ 分段解密成功", vmessStr);
  } catch (e) {
    $.msg($.name, "❌ 分段解密失败", e.message);
  } finally {
    $.done({});
  }

  // ---------- 环境工具加载函数 ----------
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
        $httpClient.get(url, (err, resp, data) => (err ? reject(err) : resolve(data)));
      } else if (typeof $task !== "undefined") {
        $task.fetch({ url }).then((resp) => resolve(resp.body), reject);
      } else {
        reject("不支持的运行环境");
      }
    });
  }
})();
