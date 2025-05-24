(async () => {
  const ENV_URL = "https://raw.githubusercontent.com/ycheng0999/cc/refs/heads/Y/evn.js";
  const API_URL = "api.banala.top/api/frostkiss/linelnfo";

  const Env = await loadEnv();
  const $ = new Env("Banana VPN 节点解密", { logLevel: "info" });

  try {
    const utils = await loadUtils($);
    $.log("✅ Utils 加载成功");

    const CryptoJS = utils.createCryptoJS();
    if (!CryptoJS) throw new Error("CryptoJS 初始化失败");

    const raw = await $.get(API_URL);
    let body = typeof raw === "string" ? JSON.parse(raw) : raw;

    const code = body.bio_code_tron || 0;
    const remark = body.bio_remark_tron || "无描述";
    const encrypted = decodeURIComponent(body.bio_result_tron?.bio_link_url_tron || "");

    if (code !== 200 || !encrypted) {
      throw new Error(`接口返回错误: code=${code}, 描述=${remark}`);
    }

    const key = CryptoJS.enc.Utf8.parse("929af8c0ac9dc557");
    const iv = CryptoJS.enc.Utf8.parse("929af8c0ac9dc557");

    const decrypted = AES_Decrypt(encrypted, key, iv, CryptoJS);

    if (!decrypted?.trim()) throw new Error("解密结果为空");

    $.log("✅ 解密成功: " + decrypted);
    $.msg("Banana VPN", "✅ 节点解密成功", decrypted);
  } catch (e) {
    $.logErr("❌ 出错: ", e);
    $.msg("Banana VPN", "❌ 节点处理失败", e.message);
  } finally {
    $.done();
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
      throw new Error("AES 解密失败: " + e.message);
    }
  }

  async function loadUtils($) {
    try {
      let code = $.getdata("Utils_Code") || "";
      if (code) {
        $.log("✅ 使用缓存的 Utils");
        eval(code);
        return creatUtils();
      }
      $.log("⏬ 下载 Utils...");
      const script = await $.get("https://cdn.jsdelivr.net/gh/xzxxn777/Surge@main/Utils/Utils.js");
      $.setdata(script, "Utils_Code");
      eval(script);
      return creatUtils();
    } catch (e) {
      throw new Error("加载 Utils 工具失败: " + e.message);
    }
  }

  async function loadEnv() {
    try {
      const code = $persistentStore.read("Eric_Env_Code") || "";
      if (code) {
        eval(code);
        return Env;
      }
      const data = await getCompatible(ENV_URL);
      if (!data || typeof data !== "string") throw new Error("下载内容无效");
      $persistentStore.write(data, "Eric_Env_Code");
      eval(data);
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
        $task.fetch({ url }).then(res => resolve(res.body), reject);
      } else {
        reject("不支持的运行环境");
      }
    });
  }
})();
