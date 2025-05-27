// VPN 节点提取器（增强版 v2 优化版）
// 支持整体解密字段 + 分字段解密，字段宽容匹配，自动识别格式，支持数组

(async () => {
  const KEYS = [
    { key: "TmPrPhkOf8by0cvx", iv: "TmPrPhkOf8by0cvx" },
    { key: "929af8c0ac9dc557", iv: "929af8c0ac9dc557" },
    { key: "817a7baa5c74b982", iv: "817a7baa5c74b982" },
    { key: "5841b418488e65cc", iv: "5841b418488e65cc" },
    { key: "AE0plfOrl4CCUO87", iv: "AE0plfOrl4CCUO87" },
    { key: "VNfo9MuDNeP8ZjYm", iv: "VNfo9MuDNeP8ZjYm" }
  ];

  const PATHS = [
    ["result", "url"],
    ["result", "web_url"],
    ["bio_result_tron"],
    ["prd_result_flg", "prd_kf_link_flg"],
    ["result", "link_Url"],
    ["line_info", "link"],
    ["msg"],
    ["payload", "data", "url"]
  ];

  const REQUIRED_FIELDS = ["address", "port", "path", "node_id"];

  const Env = await loadEnv();
  const $ = new Env("VPN节点提取器", { logLevel: "info" });

  let body = $response?.body || "";
  try {
    if (typeof body === "string") body = JSON.parse(body);
  } catch (e) {
    $.msg("❌ 响应 JSON 解析失败", "", e.message);
    return $.done();
  }

  try {
    const utils = await loadUtils($);
    const CryptoJS = utils.createCryptoJS();
    const vmessList = [];

    // 支持数组路径，遍历中间节点可能为数组的情况
    const getFieldByPath = (obj, path) => {
      try {
        for (let k of path) {
          if (Array.isArray(obj)) {
            // 对数组中每个元素取属性k，返回合并数组
            obj = obj.flatMap(item => (item && item[k] !== undefined ? (Array.isArray(item[k]) ? item[k] : [item[k]]) : []));
            if (obj.length === 0) return null;
          } else {
            obj = obj?.[k];
            if (obj === undefined || obj === null) return null;
          }
        }
        return obj;
      } catch {
        return null;
      }
    };

    // 判断是否为疑似加密的 Base64 字符串
    const isEncrypted = str =>
      typeof str === "string" &&
      /^[A-Za-z0-9+/=]+$/.test(str) && // 基本是 Base64 格式
      str.length >= 16;               // 最小长度限制

    // AES-CBC 解密
    const AES_Decrypt = (data, key, iv) => {
      try {
        const k = CryptoJS.enc.Utf8.parse(key);
        const i = CryptoJS.enc.Utf8.parse(iv);
        const decrypted = CryptoJS.AES.decrypt(data, k, {
          iv: i,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });
        return decrypted.toString(CryptoJS.enc.Utf8).replace(/[\u0000-\u001F]+/g, "");
      } catch {
        return "";
      }
    };

    // 试图解密字符串，返回 vmess 格式字符串或空
    const tryDecrypt = str => {
      let raw = str;
      try {
        raw = decodeURIComponent(str);
      } catch {}
      for (const { key, iv } of KEYS) {
        const decrypted = AES_Decrypt(raw, key, iv);
        if (!decrypted) continue;
        if (decrypted.startsWith("vmess://")) return decrypted.trim();
        try {
          const json = JSON.parse(decrypted);
          if (json?.add || json?.address) {
            return convertToVmess(json);
          }
        } catch {}
      }
      return "";
    };

    // 处理整体字段（包含链接或 JSON）
    for (const path of PATHS) {
      const val = getFieldByPath(body, path);
      if (!val) continue;
      if (Array.isArray(val)) {
        for (const v of val) {
          if (typeof v === "object" && v !== null) {
            for (const k in v) {
              const str = v[k];
              if (isEncrypted(str)) {
                const decrypted = tryDecrypt(str);
                if (decrypted) vmessList.push(decrypted);
              }
            }
          } else if (typeof v === "string" && isEncrypted(v)) {
            const decrypted = tryDecrypt(v);
            if (decrypted) vmessList.push(decrypted);
          }
        }
      } else if (typeof val === "string" && isEncrypted(val)) {
        const decrypted = tryDecrypt(val);
        if (decrypted) vmessList.push(decrypted);
      }
    }

    // 分字段解密（如 result 下的 address、port、path、node_id）
    const result = body?.result;
    if (result && typeof result === "object") {
      const fields = {};
      let success = true;

      for (const field of REQUIRED_FIELDS) {
        const raw = result[field];
        if (!raw || typeof raw !== "string" || !isEncrypted(raw)) {
          success = false;
          break;
        }
        let val = "";
        for (const { key, iv } of KEYS) {
          const decrypted = AES_Decrypt(decodeURIComponent(raw), key, iv);
          if (decrypted?.trim()) {
            val = decrypted.trim();
            break;
          }
        }
        if (!val) {
          success = false;
          break;
        }
        fields[field] = val;
      }

      if (success) {
        const name = result?.name || "香港";
        const line = `${name} = vmess, ${fields.address}, ${fields.port}, username=${fields.node_id}, ws=true, ws-path=${fields.path}, tls=true, skip-cert-verify=true, sni=${fields.address}`;
        vmessList.push(line);
      }
    }

    if (vmessList.length === 0) throw new Error("无法生成任何 vmess 配置\n字段可能未匹配或解密失败");

    for (const vmess of vmessList) $.log(vmess);
    $.msg("✅ 解密完成", `共生成 ${vmessList.length} 条配置`, vmessList[0]);
  } catch (err) {
    $.logErr("❌ 出错", err);
    $.msg("❌ 无法生成任何 vmess 配置", "", err.message);
  } finally {
    $.done();
  }

  // JSON 转 vmess 链接
  function convertToVmess(obj) {
    const vmess = {
      v: "2",
      ps: obj.ps || "1",
      add: obj.add || obj.address || "unknown",
      port: obj.port || "443",
      id: obj.id || obj.node_id || "",
      aid: obj.aid || "0",
      scy: "auto",
      net: "ws",
      type: "none",
      host: obj.host || obj.add || obj.address || "",
      path: obj.path || "/",
      tls: "tls",
      sni: obj.sni || "",
      alpn: ""
    };
    return "vmess://" + Buffer.from(JSON.stringify(vmess)).toString("base64");
  }

  // 加载工具集
  async function loadUtils($) {
    const cached = $.getdata("Utils_Code");
    if (cached) {
      eval(cached);
      return creatUtils();
    }
    const script = await $.get("https://cdn.jsdelivr.net/gh/xzxxn777/Surge@main/Utils/Utils.js");
    $.setdata(script, "Utils_Code");
    eval(script);
    return creatUtils();
  }

  // 加载环境支持库
  async function loadEnv() {
    const cached = $persistentStore.read("Eric_Env_Code");
    if (cached) {
      eval(cached);
      return Env;
    }
    const script = await getCompatible("https://raw.githubusercontent.com/ycheng0999/cc/refs/heads/Y/evn.js");
    $persistentStore.write(script, "Eric_Env_Code");
    eval(script);
    return Env;
  }

  // 兼容不同运行环境的请求函数
  function getCompatible(url) {
    return new Promise((resolve, reject) => {
      if (typeof $httpClient !== "undefined") {
        $httpClient.get(url, (err, resp, data) => (err ? reject(err) : resolve(data)));
      } else if (typeof $task !== "undefined") {
        $task.fetch({ url }).then(resp => resolve(resp.body), reject);
      } else {
        reject("不支持的运行环境");
      }
    });
  }
})();
