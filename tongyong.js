// Surge Script: VPN 节点提取器（支持字段路径+自动推断）
// 作者：ChatGPT 定制版
// 用法：配合 Banana/赛盾/银狐/快链等接口使用，提取节点链接
// 设置字段路径
const fieldPaths = [
  "result.web_url",
  "bio_result_tron[].bio_link_url_tron",
  "prd_result_flg.prd_kf_link_flg"
];

// AES 解密配置（按需替换）
const aesKey = "0000000000000000"; // 16字节key
const aesIv = "0000000000000000";  // 16字节IV

// ------------------ 主逻辑 -------------------
(async () => {
  try {
    const body = JSON.parse($response.body);

    // 尝试从字段路径中查找加密链接
    const encryptedUrl = getFieldFromPaths(body, fieldPaths);

    let finalUrl = null;
    if (encryptedUrl) {
      console.log("[字段路径] 命中字段：" + encryptedUrl);
      finalUrl = tryDecode(encryptedUrl);
    }

    // 如果字段路径未命中，启用自动推断模式
    if (!finalUrl) {
      console.log("[自动模式] 开始自动扫描链接字段...");
      const guessedUrls = findPossibleLinks(body);
      for (const url of guessedUrls) {
        console.log("尝试解密：" + url);
        finalUrl = tryDecode(url);
        if (finalUrl) {
          console.log("[自动模式] 成功解密链接：" + finalUrl);
          break;
        }
      }
    }

    if (!finalUrl) {
      console.log("❌ 解密失败：未找到有效的加密链接字段");
    } else {
      console.log("✅ 成功提取链接：\n" + finalUrl);
    }
  } catch (err) {
    console.log("❌ 脚本异常：" + err);
  } finally {
    $done({});
  }
})();

// ------------------ 工具函数 -------------------
function tryDecode(url) {
  if (!url.includes("s=")) return null;
  const encrypted = url.split("s=")[1].split("&")[0].split("#")[0];
  if (!encrypted || encrypted.length < 16) return null;

  try {
    const decrypted = aesDecrypt(encrypted, aesKey, aesIv);
    return decrypted;
  } catch (e) {
    console.log("解密错误：" + e);
    return null;
  }
}

function getFieldFromPaths(obj, paths) {
  for (const path of paths) {
    const result = extractValue(obj, path);
    if (result) return result;
  }
  return null;
}

function extractValue(obj, path) {
  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (part.endsWith("[]")) {
      const arrayKey = part.replace("[]", "");
      if (!Array.isArray(current[arrayKey])) return null;
      for (const item of current[arrayKey]) {
        const value = extractValue(item, parts.slice(parts.indexOf(part) + 1).join("."));
        if (value) return value;
      }
      return null;
    } else {
      if (typeof current !== "object" || !(part in current)) return null;
      current = current[part];
    }
  }
  return typeof current === "string" ? current : null;
}

function findPossibleLinks(obj) {
  const urls = [];
  const walk = (o) => {
    if (typeof o === "object" && o !== null) {
      for (const k in o) walk(o[k]);
    } else if (typeof o === "string") {
      if ((o.includes("s=") && o.length > 30) || /^[A-Za-z0-9+/=]{32,}$/.test(o)) {
        urls.push(o);
      }
    }
  };
  walk(obj);
  return urls;
}

function aesDecrypt(encrypted, key, iv) {
  const CryptoJS = require("crypto-js");
  const keyUtf8 = CryptoJS.enc.Utf8.parse(key);
  const ivUtf8 = CryptoJS.enc.Utf8.parse(iv);
  const decrypted = CryptoJS.AES.decrypt(encrypted, keyUtf8, {
    iv: ivUtf8,
    padding: CryptoJS.pad.Pkcs7,
    mode: CryptoJS.mode.CBC
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}