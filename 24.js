(async () => {
  const KEYS = [
    { key: "TmPrPhkOf8by0cvx", iv: "TmPrPhkOf8by0cvx" },
    { key: "929af8c0ac9dc557", iv: "929af8c0ac9dc557" },
    { key: "817a7baa5c74b982", iv: "817a7baa5c74b982" },
    { key: "5841b418488e65cc", iv: "5841b418488e65cc" },
    { key: "AE0plfOrl4CCUO87", iv: "AE0plfOrl4CCUO87" },
    { key: "VNfo9MuDNeP8ZjYm", iv: "VNfo9MuDNeP8ZjYm" },
  ];

  const Env = await loadEnv();
  const $ = new Env("VPN节点提取器", { logLevel: "info" });

  let body = $response?.body || "";
  try {
    if (typeof body === "string") body = JSON.parse(body);
  } catch (e) {
    $.error("响应解析失败：" + e);
    return $.done({});
  }

  try {
    const utils = await loadUtils($);
    const CryptoJS = utils.createCryptoJS();
    if (!CryptoJS) throw new Error("CryptoJS 加载失败");

    // 先尝试整体路径解密
    const wholePaths = [
      ["result", "web_url"], // 整体链接字段路径示例
      ["bio_result_tron", 0, "bio_link_url_tron"],
      ["prd_result_flg", "prd_kf_link_flg"],
    ];

    let encryptedWhole = null;
    let matchedWholePath = null;
    for (const path of wholePaths) {
      encryptedWhole = getByPath(body, path);
      if (typeof encryptedWhole === "string" && isProbablyEncrypted(encryptedWhole)) {
        matchedWholePath = path;
        break;
      }
    }

    if (encryptedWhole) {
      // 尝试整体解密
      const base64Url = decodeURIComponent(encryptedWhole);
      for (const { key, iv } of KEYS) {
        try {
          const k = CryptoJS.enc.Utf8.parse(key);
          const i = CryptoJS.enc.Utf8.parse(iv);
          const decrypted = AES_Decrypt(base64Url, k, i, CryptoJS);
          if (decrypted?.trim()) {
            $.msg($.name, "整体解密成功", decrypted);
            return $.done({});
          }
        } catch {}
      }
    }

    // 整体失败，尝试分段解密
    $.log("整体解密失败，尝试分段解密...");

    // 定义分段字段路径
    const segmentsPath = ["data", "segments"]; // 这里改成你分段字段真实路径
    const segments = getByPath(body, segmentsPath);
    if (!Array.isArray(segments)) throw new Error("未找到分段数据");

    // 假设每段里有 address, port, userId, path, host等字段，均加密
    // 解密函数自动尝试所有KEY
    function tryDecrypt(str) {
      if (!str) return "";
      const encStr = decodeURIComponent(str);
      for (const { key, iv } of KEYS) {
        try {
          const k = CryptoJS.enc.Utf8.parse(key);
          const i = CryptoJS.enc.Utf8.parse(iv);
          const dec = AES_Decrypt(encStr, k, i, CryptoJS);
          if (dec?.trim()) return dec;
        } catch {}
      }
      return "";
    }

    // 解密分段拼装 vmess 格式
    let resultText = "";
    for (const seg of segments) {
      const address = tryDecrypt(seg.address);
      const port = tryDecrypt(seg.port);
      const userId = tryDecrypt(seg.userId);
      const wsPath = tryDecrypt(seg.path);
      const host = tryDecrypt(seg.host) || address;
      if (!address || !port || !userId) continue;

      // 拼接示例（你可以根据实际字段调整）
      resultText += `香港 = vmess, ${address}, ${port}, username=${userId}, ws=true, ws-path=${wsPath || "/"}, tls=true, skip-cert-verify=true, sni=${host}\n`;
    }

    if (!resultText) throw new Error("分段解密失败或无有效节点");

    $.msg($.name, "分段解密成功", resultText.trim());
  } catch (err) {
    $.logErr("❌ 出错:", err);
    $.msg($.name, "解密失败", err.message);
  } finally {
    $.done({});
  }

  // 工具函数
  function getByPath(obj, path) {
    try {
      return path.reduce((acc, cur) => acc?.[cur], obj);
    } catch {
      return undefined;
    }
  }

  function isProbablyEncrypted(str) {
    return /^[A-Za-z0-9+/=]{20,}$/.test(str) || /^[\w\-]+\.[\w\-]+\.[\w\-]+$/.test(str);
  }

  function AES_Decrypt(data, key, iv, CryptoJS) {
    try {
      const decrypted = CryptoJS.AES.decrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
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
      const script = await $.get(
        "https://cdn.jsdelivr.net/gh/xzxxn777/Surge@main/Utils/Utils.js"
      );
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
      const script = await getCompatible(
        "https://raw.githubusercontent.com/ycheng0999/cc/refs/heads/Y/evn.js"
      );
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
