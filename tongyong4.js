(async () => {
  // 多字段对应多路径数组（每条路径是字符串key或数字索引的数组）
  const FIELD_PATHS = {
    address: [
      ["result", "address"],
      ["data", "address"],
      ["bio_result_tron", 0, "bio_link_url_tron"]
    ],
    port: [
      ["result", "port"],
      ["data", "port"]
    ],
    path: [
      ["result", "path"],
      ["data", "path"]
    ],
    node_id: [
      ["result", "node_id"],
      ["data", "node_id"]
    ],
    name: [
      ["result", "name"],
      ["data", "name"]
    ]
  };

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

    // 支持字符串key或数字索引的混合路径访问
    function getByMixedPath(obj, pathArr) {
      if (!obj) return null;
      let cur = obj;
      for (const p of pathArr) {
        if (cur === undefined || cur === null) return null;
        cur = cur[p];
      }
      return cur === undefined ? null : cur;
    }

    // 多路径尝试，返回第一个有效值
    function tryMixedPaths(obj, paths) {
      for (const pathArr of paths) {
        const v = getByMixedPath(obj, pathArr);
        if (v !== null && v !== undefined) return v;
      }
      return null;
    }

    // 判断字符串是否像加密串（Base64，长度阈值可调整）
    function isProbablyEncrypted(str) {
      if (typeof str !== "string") return false;
      return /^[A-Za-z0-9+/=]{16,}$/.test(str);
    }

    // AES 解密
    function AES_Decrypt(data, key, iv, CryptoJS) {
      try {
        const decrypted = CryptoJS.AES.decrypt(data, key, {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });
        return decrypted.toString(CryptoJS.enc.Utf8);
      } catch {
        return null;
      }
    }

    // 解密字段，自动尝试多key
    function decryptField(val) {
      if (!isProbablyEncrypted(val)) return val;
      const base64Str = decodeURIComponent(val);
      for (const { key, iv } of KEYS) {
        const k = CryptoJS.enc.Utf8.parse(key);
        const i = CryptoJS.enc.Utf8.parse(iv);
        const decrypted = AES_Decrypt(base64Str, k, i, CryptoJS);
        if (decrypted && decrypted.trim()) return decrypted.trim();
      }
      return null;
    }

    // 取字段值 + 解密
    function getDecryptedField(fieldName) {
      const raw = tryMixedPaths(body, FIELD_PATHS[fieldName]);
      if (raw === null || raw === undefined) return null;
      return decryptField(raw);
    }

    // 获取节点名称（可选）
    let nodeName = getDecryptedField("name") || "节点";

    // 依次解密必须字段
    const address = getDecryptedField("address");
    const port = getDecryptedField("port");
    const path = getDecryptedField("path") || "/";
    const node_id = getDecryptedField("node_id");

    if (!address || !port || !node_id) {
      $.log("❌ 必填字段缺失或解密失败");
      $.msg("❌ 无法生成任何 vmess 配置", "字段可能未匹配或解密失败");
      return $.done({});
    }

    // 生成 vmess 配置字符串 (Surge 格式)
    const vmess = `${nodeName} = vmess, ${address}, ${port}, username=${node_id}, ws=true, ws-path=${path}, tls=true, skip-cert-verify=true, sni=${address}`;
    $.msg("✅ 解密完成 + vmess ✅配置生成", "", vmess);
    $.log("配置：\n" + vmess);

  } catch (err) {
    $.logErr("❌ 出错", err);
    $.msg("VPN节点提取器", "配置生成失败", err.message);
  } finally {
    $.done({});
  }

  // 载入工具脚本
  async function loadUtils($) {
    const cached = $.getdata("Utils_Code");
    if (cached) { eval(cached); return creatUtils(); }
    const script = await $.get("https://cdn.jsdelivr.net/gh/xzxxn777/Surge@main/Utils/Utils.js");
    $.setdata(script, "Utils_Code");
    eval(script);
    return creatUtils();
  }

  // 载入Env环境封装
  async function loadEnv() {
    const cached = $persistentStore.read("Eric_Env_Code");
    if (cached) { eval(cached); return Env; }
    const script = await getCompatible("https://raw.githubusercontent.com/ycheng0999/cc/refs/heads/Y/evn.js");
    $persistentStore.write(script, "Eric_Env_Code");
    eval(script);
    return Env;
  }

  // 兼容请求
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
