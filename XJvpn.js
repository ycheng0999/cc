(async () => {
  const ENV_URL = "https://raw.githubusercontent.com/ycheng0999/cc/refs/heads/Y/evn.js";

  try {
    const Env = await loadEnv();
    const $ = new Env("香蕉加速器VPN", { logLevel: "info" });

    let body = $response?.body || "";

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        $.error("❌ 响应 JSON 解析失败: " + e.message);
        $.done({});
        return;
      }
    }

    const code = body.code || 0;
    if (code !== 200) {
      $.error("❌ 接口返回错误: " + (body.msg || "未知错误"));
      $.done({});
      return;
    }

    const utils = await loadUtils($);
    $.log("✅ Utils 加载成功");

    const CryptoJS = utils.createCryptoJS();
    if (!CryptoJS) throw new Error("CryptoJS 加载失败");

    const encryptedUrl = body.result?.url;
    if (!encryptedUrl) throw new Error("未找到加密字段");

    const key = CryptoJS.enc.Utf8.parse("817a7baa5c74b982");
    const iv = CryptoJS.enc.Utf8.parse("817a7baa5c74b982");

    const base64Url = decodeURIComponent(encryptedUrl);
    const decryptedUrl = AES_Decrypt(base64Url, key, iv, CryptoJS);

    if (!decryptedUrl?.trim()) throw new Error("解密为空");

    $.msg($.name, "✅ 节点解密成功", decryptedUrl);
    $.done({ body: JSON.stringify({ decrypted_url: decryptedUrl }) }); // 如果要让后续脚本用到
  } catch (e) {
    console.log("❌ 脚本异常:", e);
    $done({});
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
      let utilsCode = $.getdata("Utils_Code") || "";
      if (utilsCode) {
        $.log("✅ 使用缓存的 Utils");
        eval(utilsCode);
        return creatUtils();
      }

      $.log("⏬ 下载 Utils...");
      const script = await $.get("https://cdn.jsdelivr.net/gh/xzxxn777/Surge@main/Utils/Utils.js");
      if (!script) throw new Error("Utils 下载为空");
      $.setdata(script, "Utils_Code");
      eval(script);
      return creatUtils();
    } catch (e) {
      throw new Error("Utils 加载失败: " + e.message);
    }
  }

  async function loadEnv() {
    try {
      let envCode = $persistentStore.read("Eric_Env_Code") || "";
      if (envCode) {
        console.log("✅ 使用缓存的 Env");
        eval(envCode);
        if (typeof Env !== "function") throw new Error("Env 非法");
        console.log("✅ 缓存 Env 加载成功");
        return Env;
      }

      console.log("⏬ 下载 Env...");
      const data = await getCompatible(ENV_URL);
      if (!data || typeof data !== "string") throw new Error("Env 内容为空或非法");

      $persistentStore.write(data, "Eric_Env_Code");
      eval(data);
      if (typeof Env !== "function") throw new Error("Env 加载无效");

      console.log("✅ 远程 Env 加载成功");
      return Env;
    } catch (e) {
      throw new Error("Env 加载失败: " + e.message);
    }
  }

  function getCompatible(url) {
    return new Promise((resolve, reject) => {
      if (typeof $httpClient !== "undefined") {
        $httpClient.get(url, (err, resp, data) => err ? reject(err) : resolve(data));
      } else if (typeof $task !== "undefined") {
        $task.fetch({ url }).then(resp => resolve(resp.body), err => reject(err));
      } else {
        reject("环境不支持 HTTP 请求");
      }
    });
  }
})();