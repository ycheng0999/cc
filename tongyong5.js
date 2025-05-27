// Surge Script
(async () => {
  const KEYS = [
    { key: "TmPrPhkOf8by0cvx", iv: "TmPrPhkOf8by0cvx" },
    { key: "929af8c0ac9dc557", iv: "929af8c0ac9dc557" },
    { key: "817a7baa5c74b982", iv: "817a7baa5c74b982" },
    { key: "5841b418488e65cc", iv: "5841b418488e65cc" },
    { key: "AE0plfOrl4CCUO87", iv: "AE0plfOrl4CCUO87" },
    { key: "VNfo9MuDNeP8ZjYm", iv: "VNfo9MuDNeP8ZjYm" }
  ];

  const FIELD_PATHS = [
    ["result", "address"],
    ["result", "port"],
    ["result", "path"],
    ["result", "node_id"]
  ];
  const URL_PATHS = [
    ["result", "url"],
    ["result", "web_url"],
    ["bio_result_tron", 0, "bio_link_url_tron"],
    ["prd_result_flg", "prd_kf_link_flg"]
  ];

  const Env = await loadEnv();
  const $ = new Env("VPN节点提取器", { logLevel: "info" });
  const utils = await loadUtils($);
  const CryptoJS = utils.createCryptoJS();

  if (!CryptoJS) return $.done($.msg("系统错误", "CryptoJS 加载失败", ""));

  let body = $response?.body || "";
  try { if (typeof body === "string") body = JSON.parse(body); } catch (e) {
    return $.done($.msg("响应错误", "JSON 解析失败", e.message));
  }

  const results = [];
  const isBase64 = (str) => /^[A-Za-z0-9+/=]{16,}$/.test(str);

  const AES_Decrypt = (data, key, iv) => {
    try {
      const decrypted = CryptoJS.AES.decrypt(data, key, {
        iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
      });
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) { return null; }
  };

  const tryDecrypt = (val) => {
    if (typeof val !== "string" || !isBase64(val)) return null;
    for (const { key, iv } of KEYS) {
      const k = CryptoJS.enc.Utf8.parse(key);
      const i = CryptoJS.enc.Utf8.parse(iv);
      const result = AES_Decrypt(val, k, i);
      if (result?.trim()) return result;
    }
    return null;
  };

  const getDeep = (obj, path) => {
    try {
      return path.reduce((a, b) => a?.[b], obj);
    } catch { return undefined; }
  };

  // 构造字段型节点
  const addr = tryDecrypt(getDeep(body, ["result", "address"]));
  const port = tryDecrypt(getDeep(body, ["result", "port"]));
  const node_id = tryDecrypt(getDeep(body, ["result", "node_id"]));
  const path = tryDecrypt(getDeep(body, ["result", "path"]));
  const name = getDeep(body, ["result", "name"]) || "节点";

  if (addr && port && node_id && path) {
    const vmess = `${name} = vmess, ${addr}, ${port}, username=${node_id}, ws=true, ws-path=${path}, tls=true, skip-cert-verify=true, sni=${addr}`;
    results.push(vmess);
  }

  // 扫描整体链接字段
  for (const path of URL_PATHS) {
    const raw = getDeep(body, path);
    const dec = tryDecrypt(raw);
    if (dec) {
      if (dec.includes("vmess://")) {
        const lines = dec.split(/\\r?\\n/).filter(l => l.trim().startsWith("vmess://"));
        results.push(...lines);
      } else {
        try {
          const json = JSON.parse(dec);
          if (Array.isArray(json)) {
            for (const node of json) {
              const line = typeof node === "string" ? node : node?.url || "";
              if (line.includes("vmess://")) results.push(line);
            }
          }
        } catch {}
      }
    }
  }

  const unique = Array.from(new Set(results)).filter(Boolean);
  if (unique.length) {
    for (const line of unique) $.log(line);
    $.msg("✅ 解密完成", "", `共生成 ${unique.length} 条配置`);
  } else {
    $.msg("❌ 无法生成任何 vmess 配置", "字段可能未匹配或解密失败", "");
  }
  $.done({});

  async function loadUtils($) {
    const cached = $.getdata("Utils_Code");
    if (cached) { eval(cached); return creatUtils(); }
    const script = await $.get("https://cdn.jsdelivr.net/gh/xzxxn777/Surge@main/Utils/Utils.js");
    $.setdata(script, "Utils_Code");
    eval(script);
    return creatUtils();
  }

  async function loadEnv() {
    const cached = $persistentStore.read("Eric_Env_Code");
    if (cached) { eval(cached); return Env; }
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
