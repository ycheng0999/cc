(async () => {
  const ENV_URL = "https://raw.githubusercontent.com/ycheng0999/cc/refs/heads/Y/evn.js";

  const Env = await loadEnv(); // 加载 Env
  const $ = new Env("香蕉加速器VPN", { logLevel: "info" });

  let body = $response?.body || "";

  try {
    if (typeof body === "string") body = JSON.parse(body);
  } catch (e) {
    $.error("响应解析失败: " + e);
    $.done({});
    return;
  }

  const code = body.bio_code_tron;
  if (code !== 200) {
    $.error("API 返回失败: " + (body.bio_remark_tron || "未知错误"));
    $.done({});
    return;
  }

  try {
    const encryptedUrl = body.bio_result_tron?.bio_link_url_tron;
    if (!encryptedUrl) throw new Error("未找到加密链接");

    const utils = await loadUtils($);
    const CryptoJS = utils.createCryptoJS();
    if (!CryptoJS) throw new Error("CryptoJS 初始化失败");

    const key = CryptoJS.enc.Utf8.parse("817a7baa5c74b982");
    const iv = CryptoJS.enc.Utf8.parse("817a7baa5c74b982");

    const decrypted = AES_Decrypt(encryptedUrl, key, iv, CryptoJS);

    if (!decrypted?.trim()) throw new Error("解密内容为空");

    $.msg($.name, "✅ 节点解密成功", decrypted);
  } catch (e) {
    $.logErr("解密失败: ", e);
    $.msg($.name, "❌ 节点处理失败", e.message);
  } finally {
    $.done({});
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
      const cached = $.getdata("Utils_Code");
      if (cached) {
        eval(cached);
        return creatUtils();
      }

      const script = await $.get("https://cdn.jsdelivr.net/gh/xzxxn777/Surge@main/Utils/Utils.js");
      $.setdata(script, "Utils_Code");
      eval(script);
      return creatUtils();
    } catch (e) {
      throw new Error("Utils 加载失败: " + e.message);
    }
  }

  async function loadEnv() {
    try {
      const cached = $persistentStore.read("Eric_Env_Code");
      if (cached) {
        eval(cached);
        return Env;
      }

      const code = await getCompatible(ENV_URL);
      $persistentStore.write(code, "Eric_Env_Code");
      eval(code);
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