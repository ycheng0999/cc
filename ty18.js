(async () => {
  const KEYS = [
    { key: "TmPrPhkOf8by0cvx", iv: "TmPrPhkOf8by0cvx" },
    { key: "929af8c0ac9dc557", iv: "929af8c0ac9dc557" },
    { key: "817a7baa5c74b982", iv: "817a7baa5c74b982" },
    { key: "5841b418488e65cc", iv: "5841b418488e65cc" },
    { key: "AE0plfOrl4CCUO87", iv: "AE0plfOrl4CCUO87" },
    { key: "VNfo9MuDNeP8ZjYm", iv: "VNfo9MuDNeP8ZjYm" },
  ];

  const $ = new Env("VPN节点提取器");

  let body = $response?.body || "";
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      $.log("响应解析失败：" + e);
      return $.done({});
    }
  }

  const CryptoJS = await loadCryptoJS();

  // AES 解密
  function aesDecrypt(base64Data, keyStr, ivStr) {
    try {
      const key = CryptoJS.enc.Utf8.parse(keyStr);
      const iv = CryptoJS.enc.Utf8.parse(ivStr);
      const decrypted = CryptoJS.AES.decrypt(base64Data, key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch {
      return null;
    }
  }

  // 判断可能是Base64加密字符串
  function isBase64(str) {
    return /^[A-Za-z0-9+/=]+$/.test(str);
  }

  // --------- 新增：分字段解密 -----------
  function tryDecryptNodeFields(node, keyObj) {
    if (!node || typeof node !== "object") return null;
    try {
      const address = aesDecrypt(node.address, keyObj.key, keyObj.iv);
      const mask_host = aesDecrypt(node.mask_host, keyObj.key, keyObj.iv);
      const node_id = aesDecrypt(node.node_id, keyObj.key, keyObj.iv);
      const path = aesDecrypt(node.path, keyObj.key, keyObj.iv);
      const port = aesDecrypt(node.port, keyObj.key, keyObj.iv);

      if (!address || !node_id || !port) return null;

      return {
        address,
        mask_host: mask_host || address,
        node_id,
        path: path || "",
        port,
      };
    } catch {
      return null;
    }
  }

  function buildVmess(node, remark) {
    // 你可根据实际需求改格式
    return `vmess://${Buffer.from(JSON.stringify({
      v: "2",
      ps: remark || "未知节点",
      add: node.address,
      port: node.port,
      id: node.node_id,
      aid: "0",
      net: "ws",
      type: "none",
      host: node.mask_host || "",
      path: node.path || "",
      tls: "tls"
    })).toString("base64")}`;
  }

  // --------- 原整体字段路径解密 ----------
  const PATHS = [
    ["result", "web_url"],
    ["bio_result_tron", 0, "bio_link_url_tron"],
    ["prd_result_flg", "prd_link_url_flg"]
  ];

  function getByPath(obj, path) {
    try {
      return path.reduce((acc, cur) => acc?.[cur], obj);
    } catch {
      return undefined;
    }
  }

  function isProbablyEncrypted(str) {
    // 基本检测Base64或JWT格式
    return /^[A-Za-z0-9+/=]{20,}$/.test(str) || /^[\w\-]+\.[\w\-]+\.[\w\-]+$/.test(str);
  }

  function findEncryptedString(obj, depth = 0) {
    if (depth > 6) return null;
    if (typeof obj === "string" && isProbablyEncrypted(obj)) return obj;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = findEncryptedString(item, depth + 1);
        if (result) return result;
      }
    } else if (typeof obj === "object" && obj !== null) {
      for (const key in obj) {
        const result = findEncryptedString(obj[key], depth + 1);
        if (result) return result;
      }
    }
    return null;
  }

  function aesDecryptString(data, keyStr, ivStr) {
    try {
      const key = CryptoJS.enc.Utf8.parse(keyStr);
      const iv = CryptoJS.enc.Utf8.parse(ivStr);
      const decrypted = CryptoJS.AES.decrypt(data, key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch {
      return null;
    }
  }

  // -------------- 主逻辑 ---------------
  try {
    // 先尝试分字段解密（新结构）
    if (body.result && typeof body.result === "object") {
      for (const keyObj of KEYS) {
        const decryptedNode = tryDecryptNodeFields(body.result, keyObj);
        if (decryptedNode) {
          const vmess = buildVmess(decryptedNode, body.result.name || "未知节点");
          $.msg("VPN节点提取器", "✅ 分字段解密成功", vmess);
          return $.done({});
        }
      }
    }

    // 再尝试整体路径字段解密
    let encrypted = null;
    let matchedPath = null;
    for (const path of PATHS) {
      encrypted = getByPath(body, path);
      if (typeof encrypted === "string" && isProbablyEncrypted(encrypted)) {
        matchedPath = path;
        break;
      }
    }

    if (!encrypted) {
      $.log("未通过路径匹配到字段，开始递归查找...");
      encrypted = findEncryptedString(body);
    }

    if (!encrypted) throw new Error("未找到加密链接字段");

    for (const keyObj of KEYS) {
      const decrypted = aesDecryptString(decodeURIComponent(encrypted), keyObj.key, keyObj.iv);
      if (decrypted?.trim()) {
        $.msg("VPN节点提取器", "✅ 整体字段解密成功", decrypted);
        return $.done({});
      }
    }

    throw new Error("所有 key/iv 解密失败");

  } catch (e) {
    $.logErr("错误", e);
    $.msg("VPN节点提取器", "解密失败", e.message);
  } finally {
    $.done({});
  }

  // --------- 动态加载 CryptoJS ----------
  async function loadCryptoJS() {
    if (typeof CryptoJS !== "undefined") return CryptoJS;
    const url = "https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.min.js";
    return new Promise((resolve, reject) => {
      if (typeof $httpClient !== "undefined") {
        $httpClient.get(url, (err, resp, data) => {
          if (err) return reject(err);
          eval(data);
          resolve(CryptoJS);
        });
      } else if (typeof $task !== "undefined") {
        $task.fetch({ url }).then(resp => {
          eval(resp.body);
          resolve(CryptoJS);
        }, reject);
      } else {
        reject("环境不支持");
      }
    });
  }

  // --------- 环境适配 ----------
  function Env(name) {
    this.name = name;
    this.msg = (title, subtitle, body) => console.log(`${title}\n${subtitle}\n${body}`);
    this.log = console.log;
    this.logErr = console.error;
    this.done = () => {};
  }
})();
