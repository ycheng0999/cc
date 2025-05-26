(async () => {
  const $ = new Env("VPN节点提取器", { logLevel: "info" });

  let body = $response?.body || "";
  try {
    if (typeof body === "string") body = JSON.parse(body);
  } catch (e) {
    $.error("响应解析失败：" + e.message);
    $.done({});
    return;
  }

  // 预设自动尝试的字段路径（支持点分割和数组索引）
  const possiblePaths = [
    "result.url",
    "result.web_url",
    "bio_result_tron[0].bio_link_url_tron",
    "prd_result_flg.prd_kf_link_flg",
    "body.result.web_url",
    "bio_result_tron[0].bio_code_tron", // 备用，视接口调整
  ];

  // AES key 和 iv（可临时修改）
  const AESKeyStr = "TmPrPhkOf8by0cvx";
  const AESIvStr = "TmPrPhkOf8by0cvx";

  // 解析路径辅助函数
  function getValueByPath(obj, path) {
    try {
      return path.split('.').reduce((acc, part) => {
        // 支持数组索引，例如 bio_result_tron[0]
        if (!acc) return null;
        let m = part.match(/^(\w+)(\[(\d+)\])?$/);
        if (!m) return null;
        let key = m[1];
        let index = m[3];
        let val = acc[key];
        if (index !== undefined) val = Array.isArray(val) ? val[parseInt(index)] : null;
        return val;
      }, obj);
    } catch {
      return null;
    }
  }

  // 尝试自动获取加密链接字段
  let encryptedUrl = null;
  for (let path of possiblePaths) {
    let val = getValueByPath(body, path);
    if (val && typeof val === "string" && val.trim()) {
      encryptedUrl = val.trim();
      $.log(`尝试路径成功：${path} = ${encryptedUrl}`);
      break;
    }
  }

  if (!encryptedUrl) {
    $.error("未找到有效的加密链接字段");
    $.done({});
    return;
  }

  // AES 解密函数
  function aesDecrypt(data, keyStr, ivStr) {
    try {
      const CryptoJS = require("crypto-js"); // Node.js 环境示例
      const key = CryptoJS.enc.Utf8.parse(keyStr);
      const iv = CryptoJS.enc.Utf8.parse(ivStr);

      // 如果是 URL encoded，先 decode
      let dataStr = decodeURIComponent(data);

      // 判断是否为 Base64 或 JWT（JWT格式示例）
      if (dataStr.split('.').length === 3) {
        // JWT 不解密，直接返回（如果你需要解析 JWT，可以用 jwt-decode 等库）
        return dataStr;
      }

      // AES CBC 解密
      let decrypted = CryptoJS.AES.decrypt(dataStr, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      let result = decrypted.toString(CryptoJS.enc.Utf8);
      if (!result) throw new Error("解密后为空");
      return result;
    } catch (e) {
      throw new Error("AES 解密失败: " + e.message);
    }
  }

  try {
    // 根据环境载入 CryptoJS（Surge、QuanX、Node等环境自行适配）
    let CryptoJS;
    if (typeof require === "function") {
      CryptoJS = require("crypto-js");
    } else {
      // 这里假设你已预加载 CryptoJS 库，否则需要动态加载
      CryptoJS = window.CryptoJS || null;
    }

    if (!CryptoJS) throw new Error("未加载 CryptoJS");

    let decrypted = aesDecrypt(encryptedUrl, AESKeyStr, AESIvStr);

    $.msg($.name, "解密成功", decrypted);
  } catch (e) {
    $.error("解密失败：" + e.message);
    $.msg($.name, "解密失败", e.message);
  } finally {
    $.done({});
  }
})();

// 环境类 Env 需要你自行提供或使用你的版本