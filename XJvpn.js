(async () => {
  const ENV_URL = "https://raw.githubusercontent.com/ycheng0999/cc/refs/heads/Y/evn.js";
  const UTILS_URL = "https://cdn.jsdelivr.net/gh/xzxxn777/Surge@main/Utils/Utils.js";

  const Env = await loadEnv();
  const $ = new Env("香蕉加速器VPN", { logLevel: "info" });

  $.log("🔔香蕉加速器VPN, 开始!");

  let body = $response?.body;
  if (!body) {
    $.logErr("响应体为空");
    $.done({});
    return;
  }

  try {
    if (typeof body === "string") body = JSON.parse(body);
  } catch (err) {
    $.logErr("响应 JSON 解析失败", err);
    $.done({});
    return;
  }

  const code = body.bio_code_tron || 0;
  if (code !== 200) {
    $.logErr("接口返回异常", body.bio_remark_tron || "未知错误");
    $.done({});
    return;
  }

  const encrypted = body.bio_result_tron?.bio_link_url_tron;
  if (!encrypted) {
    $.logErr("未找到 bio_link_url_tron 字段");
    $.done({});
    return;
  }

  try {
    const utils = await loadUtils($);
    const CryptoJS = utils.createCryptoJS();

    const key = CryptoJS.enc.Utf8.parse("817a7baa5c74b982");
    const iv = CryptoJS.enc.Utf8.parse("817a7baa5c74b982");

    const decrypted = AES_Decrypt(encrypted, key, iv, CryptoJS);
    if (!decrypted.trim()) throw new Error("解密结果为空");

    $.log("✅ 解密成功:", decrypted);
    $.msg($.name, "解密成功", decrypted);
  } catch (e) {
    $.logErr("解密失败", e);
    $.msg($.name, "❌ 解密失败", e.message);
  } finally {
    $.done({});
  }

  function AES_Decrypt(data, key, iv, CryptoJS) {
    try {
      const decrypted = CryptoJS.AES.decrypt(data, key, {
        iv,
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
      let code = $.getdata("Utils_Code");
      if (code) {
        $.log("✅ 使用缓存的 Utils");
        eval(code);
        return creatUtils();
      }

      $.log("⏬ 下载 Utils...");
      const script = await $.get(UTILS_URL);
      $.setdata(script, "Utils_Code");
      eval(script);
      return creatUtils();
    } catch (e) {
      throw new Error("加载 Utils 工具库失败: " + e.message);
    }
  }

  async function loadEnv() {
    try {
      let code = $persistentStore.read("Eric_Env_Code");
      if (code) {
        console.log("✅ 使用缓存的 Env");
        eval(code);
        return Env;
      }

      console.log("⏬ 正在下载 Env...");
      const data = await getCompatible(ENV_URL);
      if (!data || typeof data !== "string") throw new Error("下载内容无效");

      $persistentStore.write(data, "Eric_Env_Code");
      eval(data);
      return Env;
    } catch (e) {
      throw new Error("Env 加载失败: " + e.message);
    }
  }

  function getCompatible(url) {
    return new Promise((resolve, reject) => {
      if (typeof $httpClient !== "undefined") {
        $httpClient.get(url, (err, resp, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      } else if (typeof $task !== "undefined") {
        $task.fetch({ url }).then((resp) => resolve(resp.body), reject);
      } else {
        reject("不支持的运行环境");
      }
    });
  }
})();