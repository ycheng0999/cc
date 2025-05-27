(async () => {
  const KEYS = [
    { key: "TmPrPhkOf8by0cvx", iv: "TmPrPhkOf8by0cvx" },
    { key: "929af8c0ac9dc557", iv: "929af8c0ac9dc557" },
    { key: "817a7baa5c74b982", iv: "817a7baa5c74b982" },
    { key: "5841b418488e65cc", iv: "5841b418488e65cc" },
    { key: "AE0plfOrl4CCUO87", iv: "AE0plfOrl4CCUO87" },
    { key: "VNfo9MuDNeP8ZjYm", iv: "VNfo9MuDNeP8ZjYm" },
  ];

  function fixKeyIv(str) {
    if (str.length === 16) return str;
    if (str.length === 8) return str + str;
    return str.padEnd(16, '0');
  }

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

    // 这些路径是整体加密字段尝试
    const overallPaths = [
      ["result", "web_url"],
      ["bio_result_tron", 0, "bio_link_url_tron"],
      ["prd_result_flg", "prd_kf_link_flg"],
    ];

    // 这些路径是分段加密字段尝试
    const segmentedPaths = [
      ["result"], // 例：整个 result 里面可能有多个字段分段加密
      ["bio_result_tron", 0],
    ];

    // 先尝试整体字段解密
    let encrypted = null;
    let matchedPath = null;
    for (const path of overallPaths) {
      encrypted = getByPath(body, path);
      if (typeof encrypted === "string" && isProbablyEncrypted(encrypted)) {
        matchedPath = path;
        break;
      }
    }

    // 整体字段没找到就尝试分段字段
    if (!encrypted) {
      // 遍历分段路径，尝试解密每个关键字段
      for (const path of segmentedPaths) {
        let segmentObj = getByPath(body, path);
        if (segmentObj && typeof segmentObj === "object") {
          // 关键分段字段名列表
          const keys = ["address", "port", "node_id", "path"];
          let decryptedFields = {};
          let allDecrypted = true;

          for (const key of keys) {
            let encryptedVal = segmentObj[key];
            if (!encryptedVal || !isProbablyEncrypted(encryptedVal)) {
              allDecrypted = false;
              break;
            }

            let decryptedVal = null;
            for (const { key: k, iv: ivv } of KEYS) {
              try {
                const kk = CryptoJS.enc.Utf8.parse(fixKeyIv(k));
                const ivvv = CryptoJS.enc.Utf8.parse(fixKeyIv(ivv));
                decryptedVal = AES_Decrypt(decodeURIComponent(encryptedVal), kk, ivvv, CryptoJS);
                if (decryptedVal?.trim()) break;
              } catch { }
            }

            if (!decryptedVal) {
              allDecrypted = false;
              break;
            }

            decryptedFields[key] = decryptedVal;
          }

          if (allDecrypted) {
            // 格式化输出成 Surge vmess 格式字符串
            // 你给的示例：香港 = vmess, n1737508071.wozao.cc, 443, username=xxx, ws=true, ws-path=/, tls=true, skip-cert-verify=true, sni=...
            // 这里演示一个简单版，假设 id=node_id，地址address，端口port，path，tls和ws都为true，其他按需补充

            const name = segmentObj.name || "未知节点";
            const address = decryptedFields.address;
            const port = decryptedFields.port;
            const id = decryptedFields.node_id;
            const path = decryptedFields.path || "/";
            const ws = true;
            const tls = true;
            const skipCertVerify = true;
            const sni = address;

            const resultStr = `${name} = vmess, ${address}, ${port}, username=${id}, ws=${ws}, ws-path=${path}, tls=${tls}, skip-cert-verify=${skipCertVerify}, sni=${sni}`;
            $.msg($.name, "✅ 分段解密成功", resultStr);
            return $.done({});
          }
        }
      }
    }

    // 如果整体字段有内容，尝试解密输出
    if (encrypted) {
      let decrypted = "";
      for (const { key, iv } of KEYS) {
        try {
          const k = CryptoJS.enc.Utf8.parse(fixKeyIv(key));
          const i = CryptoJS.enc.Utf8.parse(fixKeyIv(iv));
          decrypted = AES_Decrypt(decodeURIComponent(encrypted), k, i, CryptoJS);
          if (decrypted?.trim()) {
            $.msg($.name, "✅ 整体解密成功", decrypted);
            return $.done({});
          }
        } catch { }
      }
    }

    throw new Error("所有解密尝试失败");

  } catch (err) {
    $.logErr("❌ 出错:", err);
    $.msg($.name, "解密失败", err.message);
  } finally {
    $.done({});
  }

  // 工具函数同前，略，完整可以参考之前脚本

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
        padding: CryptoJS.pad.Pkcs7
      });
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
      return null;
    }
  }

  async function loadUtils($) {
    try {
      const cached = $.getdata("Utils_Code");
      if (cached) { eval(cached); return creatUtils(); }
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
      if (cached) { eval(cached); return Env; }
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
        $httpClient.get(url, (err, resp, data) => err ? reject(err) : resolve(data));
      } else if (typeof $task !== "undefined") {
        $task.fetch({ url }).then(resp => resolve(resp.body), reject);
      } else {
        reject("不支持的运行环境");
      }
    });
  }
})();
