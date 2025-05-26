(async () => {
  const ENV_URL = "https://raw.githubusercontent.com/ycheng0999/cc/refs/heads/Y/evn.js";

  const Env = await loadEnv(); // 加载 Env
  const $ = new Env("🎉快链加速器", {
    logLevel: "info"
  });

  let body = $response?.body || "";

  try {
    if (typeof body === "string") body = JSON.parse(body);
  } catch (e) {
    $.error("解析响应失败: " + e);
    $.done({});
    return;
  }

  const code = body.code || 0;

  if (code != 200) {
    $.error("接口报错: " + (body.msg || "未知错误"));
    $.done({});
    return;
  }

  try {
    const utils = await loadUtils($);
    $.log("✅Utils 加载成功");

    const CryptoJS = utils.createCryptoJS();
    if (!CryptoJS) throw new Error("CryptoJS 初始化失败");

    const encryptedUrl = body.result?.url;
    if (!encryptedUrl) throw new Error("未找到加密 URL");

    const key = CryptoJS.enc.Utf8.parse("TmPrPhkOf8by0cvx");
    const iv = CryptoJS.enc.Utf8.parse("TmPrPhkOf8by0cvx");

    const base64Url = decodeURIComponent(encryptedUrl);
    const decryptedUrl = AES_Decrypt(base64Url, key, iv, CryptoJS);

    if (!decryptedUrl?.trim()) throw new Error("解密结果为空");

    $.msg($.name, "✅ 解密成功", decryptedUrl);
  } catch (e) {
    $.logErr("处理出错: ", e);
    $.msg($.name, "❌ 解密失败", e.message);
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
      $.logErr("AES 解密失败: ", e);
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
      $.setdata(script, "Utils_Code");
      eval(script);
      return creatUtils();
    } catch (e) {
      $.logErr("加载 Utils 失败: ", e);
      throw new Error("无法加载 Utils 工具库");
    }
  }

  async function loadEnv() {
    try {
      let envCode = $persistentStore.read("Eric_Env_Code") || "";
      if (envCode) {
        console.log("✅ 使用缓存的 Env");
        eval(envCode);
        if (typeof Env !== "function") throw new Error("缓存 Env 无效");
        console.log("✅ 缓存 Env 加载成功");
        return Env;
      }

      console.log("⏬ 正在下载 Env...");
      const data = await getCompatible(ENV_URL);
      if (!data || typeof data !== "string") throw new Error("下载内容为空或无效");

      $persistentStore.write(data, "Eric_Env_Code");
      eval(data);

      if (typeof Env !== "function") throw new Error("下载的 Env 无效");

      console.log("✅ 远程 Env 加载成功");
      return Env;
    } catch (e) {
      console.log("❌ Env 加载失败: " + e.message);
      throw new Error("无法加载 Env 环境: " + e.message);
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
        $task.fetch({ url }).then(
          (resp) => resolve(resp.body),
          (err) => reject(err)
        );
      } else {
        reject("不支持的运行环境");
      }
    });
  }
})();
