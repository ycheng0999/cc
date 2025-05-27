(async () => {
  const KEYS = [
    { key: "TmPrPhkOf8by0cvx", iv: "TmPrPhkOf8by0cvx" },
    { key: "929af8c0ac9dc557", iv: "929af8c0ac9dc557" },
    { key: "817a7baa5c74b982", iv: "817a7baa5c74b982" },
    { key: "5841b418488e65cc", iv: "5841b418488e65cc" },
    { key: "AE0plfOrl4CCUO87", iv: "AE0plfOrl4CCUO87" },
    { key: "VNfo9MuDNeP8ZjYm", iv: "VNfo9MuDNeP8ZjYm" },
  ];

  const $ = new (class {
    constructor() {
      this.name = "VPN节点提取器";
      this.logs = [];
    }
    msg(title, subtitle, message) {
      this.logs.push({ title, subtitle, message });
      console.log(`${title} - ${subtitle}\n${message}\n`);
    }
    error(msg) {
      this.msg(this.name, "错误", msg);
    }
    done() {
      // 可做收尾处理
    }
  })();

  function parseJSON(str) {
    try {
      return typeof str === "string" ? JSON.parse(str) : str;
    } catch {
      return null;
    }
  }

  // AES CBC 解密，base64 或 URL 解码后解密
  function AES_Decrypt(data, key, iv, CryptoJS) {
    try {
      if (!data) return null;
      // 先尝试base64解码
      let cipherParams;
      try {
        cipherParams = CryptoJS.enc.Base64.parse(decodeURIComponent(data));
      } catch {
        // 如果失败，尝试直接base64解码
        cipherParams = CryptoJS.enc.Base64.parse(data);
      }
      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: cipherParams },
        key,
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        }
      );
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch {
      return null;
    }
  }

  // 递归遍历找所有字符串类型字段
  function findAllStrings(obj, path = []) {
    let results = [];
    if (typeof obj === "string") {
      results.push({ path, value: obj });
    } else if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        results = results.concat(findAllStrings(obj[key], path.concat(key)));
      }
    }
    return results;
  }

  // 根据路径获取值
  function getByPath(obj, path) {
    return path.reduce((acc, cur) => (acc ? acc[cur] : undefined), obj);
  }

  // 加载 CryptoJS
  function loadCryptoJS() {
    // 这里用 surge/quan 的内置 CryptoJS
    if (typeof CryptoJS !== "undefined") return CryptoJS;
    // 如果没有内置，脚本环境需要另外加载
    return null;
  }

  const CryptoJS = loadCryptoJS();
  if (!CryptoJS) {
    $.error("CryptoJS 未加载，无法解密");
    return $.done();
  }

  // 假设响应体是 $response.body（测试可替换）
  let body = $response && $response.body ? $response.body : "";
  const data = parseJSON(body);
  if (!data) {
    $.error("响应体非有效 JSON");
    return $.done();
  }

  // --------- 1. 尝试分段解密 ---------
  const segmentedPaths = {
    name: ["result", "name"],
    address: ["result", "address"],
    port: ["result", "port"],
    uuid: ["result", "node_id"],
    wsPath: ["result", "path"],
    sni: ["result", "mask_host"],
  };

  function trySegmentedDecrypt() {
    try {
      const name = getByPath(data, segmentedPaths.name) || "未命名";
      const fieldsToDecrypt = ["address", "port", "uuid", "wsPath", "sni"];
      const decryptedFields = {};

      for (const field of fieldsToDecrypt) {
        const encrypted = getByPath(data, segmentedPaths[field]);
        if (!encrypted) throw new Error(`缺少字段：${field}`);

        let decrypted = "";
        for (const { key, iv } of KEYS) {
          const k = CryptoJS.enc.Utf8.parse(key);
          const i = CryptoJS.enc.Utf8.parse(iv);
          decrypted = AES_Decrypt(encrypted, k, i, CryptoJS);
          if (decrypted?.trim()) break;
        }
        if (!decrypted) throw new Error(`字段${field}解密失败`);
        decryptedFields[field] = decrypted.trim();
      }

      const ws = true,
        tls = true,
        skipCertVerify = true;
      const sni = decryptedFields.sni || decryptedFields.address;

      const vmessStr = `${name} = vmess, ${decryptedFields.address}, ${decryptedFields.port}, username=${decryptedFields.uuid}, ws=${ws}, ws-path=${decryptedFields.wsPath || "/"}, tls=${tls}, skip-cert-verify=${skipCertVerify}, sni=${sni}`;
      $.msg($.name, "分段解密成功", vmessStr);
    } catch (e) {
      $.msg($.name, "分段解密失败", e.message);
    }
  }

  // --------- 2. 尝试整体解密 ---------
  // 找可能的加密字段，解密后尝试解析 vmess 或 JSON
  function tryOverallDecrypt() {
    try {
      // 递归找所有字符串，尝试解密其中一个整体字段
      const allStrings = findAllStrings(data);

      let success = false;
      for (const { path, value } of allStrings) {
        for (const { key, iv } of KEYS) {
          const k = CryptoJS.enc.Utf8.parse(key);
          const i = CryptoJS.enc.Utf8.parse(iv);
          const decrypted = AES_Decrypt(value, k, i, CryptoJS);
          if (decrypted && decrypted.trim()) {
            // 判断是否是完整 vmess URL 或 JSON
            if (decrypted.startsWith("vmess://")) {
              $.msg(
                $.name,
                `整体解密成功 (vmess URL) 路径:${path.join(".")}`,
                decrypted.trim()
              );
              success = true;
              break;
            }
            try {
              const parsed = JSON.parse(decrypted);
              // 简单判断是否像 vmess 节点结构
              if (
                parsed &&
                (parsed.v || parsed.ps || parsed.add || parsed.port)
              ) {
                $.msg(
                  $.name,
                  `整体解密成功 (JSON) 路径:${path.join(".")}`,
                  JSON.stringify(parsed, null, 2)
                );
                success = true;
                break;
              }
            } catch {}
          }
        }
        if (success) break;
      }

      if (!success) $.msg($.name, "整体解密失败", "未找到可解密有效字段");
    } catch (e) {
      $.msg($.name, "整体解密异常", e.message);
    }
  }

  // 依次尝试
  trySegmentedDecrypt();
  tryOverallDecrypt();

  $.done();
})();
