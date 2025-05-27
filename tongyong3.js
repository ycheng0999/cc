// @grant surgebypass
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
    $.error("响应 JSON 解析失败：" + e);
    return $.done({});
  }

  const utils = await loadUtils($);
  const CryptoJS = utils.createCryptoJS();
  if (!CryptoJS) return $.done("CryptoJS 加载失败");

  const flatten = (obj, prefix = "") =>
    Object.entries(obj).flatMap(([k, v]) =>
      typeof v === "object" && v !== null
        ? flatten(v, `${prefix}${k}.`)
        : [[`${prefix}${k}`, v]]
    );

  const candidates = flatten(body).filter(([k, v]) => isProbablyEncrypted(v));
  if (candidates.length === 0) return $.msg("未发现加密字段", "", "终止执行"), $.done({});

  const groups = groupFields(candidates);
  const generated = new Set();

  for (const fields of groups) {
    const fieldMap = {};
    for (const [key, val] of fields) {
      const field = extractFieldName(key);
      const decrypted = tryDecrypt(val, CryptoJS);
      if (decrypted) fieldMap[field] = decrypted;
    }

    if (["address", "port", "path", "node_id"].every(f => fieldMap[f])) {
      const addr = fieldMap.address;
      const vmess = `香港 = vmess, ${addr}, ${fieldMap.port}, username=${fieldMap.node_id}, ws=true, ws-path=${fieldMap.path}, tls=true, skip-cert-verify=true, sni=${addr}`;
      if (!generated.has(vmess)) {
        generated.add(vmess);
        $.msg("✅ 解密完成 + vmess ✅配置生成", "", vmess);
        $.log("配置：\n" + vmess);
      }
    }
  }

  if (!generated.size) {
    $.msg("❌ 无法生成任何 vmess 配置", "字段可能未匹配或解密失败", "");
  }

  $.done({});

  function isProbablyEncrypted(str) {
    return typeof str === "string" && /^[A-Za-z0-9+/=]{16,}$/.test(str);
  }

  function tryDecrypt(base64Str, CryptoJS) {
    for (const { key, iv } of KEYS) {
      try {
        const k = CryptoJS.enc.Utf8.parse(key);
        const i = CryptoJS.enc.Utf8.parse(iv);
        const decrypted = CryptoJS.AES.decrypt(base64Str, k, {
          iv: i,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        }).toString(CryptoJS.enc.Utf8);
        if (decrypted?.trim()) return decrypted;
      } catch {}
    }
    return null;
  }

  function extractFieldName(path) {
    const name = path.toLowerCase();
    if (name.includes("addr")) return "address";
    if (name.includes("port")) return "port";
    if (name.includes("path")) return "path";
    if (name.includes("node_id") || name.includes("uuid")) return "node_id";
    return null;
  }

  function groupFields(pairs) {
    const grouped = [];
    const temp = {};
    for (const [k, v] of pairs) {
      const id = k.split(".").slice(0, -1).join(".");
      if (!temp[id]) temp[id] = [];
      temp[id].push([k, v]);
    }
    return Object.values(temp);
  }

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
