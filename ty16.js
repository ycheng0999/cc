(async () => {
  // 固定key和iv
  const key = "5841b418488e65cc";
  const iv = "5841b418488e65cc";

  // Surge 环境封装
  const $ = new (class {
    constructor() {
      this.name = "VPN节点提取器";
    }
    msg(title, subtitle = "", body = "") {
      console.log(`${title}\n${subtitle}\n${body}`);
    }
    log(...args) {
      console.log(...args);
    }
    logErr(...args) {
      console.error(...args);
    }
    done() {
      // Surge 脚本调用结束
    }
  })();

  // AES-CBC解密函数
  function AES_Decrypt(data, key, iv) {
    try {
      const CryptoJS = importCryptoJS();
      const k = CryptoJS.enc.Utf8.parse(key);
      const i = CryptoJS.enc.Utf8.parse(iv);
      const decrypted = CryptoJS.AES.decrypt(data, k, {
        iv: i,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
      return "";
    }
  }

  // 引入 CryptoJS（从 jsdelivr 加载）
  function importCryptoJS() {
    if (typeof CryptoJS !== "undefined") return CryptoJS;
    throw new Error("请在Surge环境下提前引入CryptoJS依赖，或者用支持CryptoJS的环境");
  }

  try {
    let body = $response.body;
    if (typeof body === "string") body = JSON.parse(body);

    // 读取待解密字段
    const encStr = body?.prd_result_flg?.prd_link_url_flg;
    if (!encStr) throw new Error("字段 prd_result_flg.prd_link_url_flg 不存在");

    // 因为接口返回是Base64加密串
    // 直接Base64解密为 CipherParams
    const CryptoJS = importCryptoJS();
    const cipherParams = CryptoJS.enc.Base64.parse(encStr);

    // 解密
    const decrypted = AES_Decrypt(cipherParams, key, iv);
    if (!decrypted) throw new Error("解密失败");

    $.log("解密结果：", decrypted);

    // 这里假设解密后是vmess链接或JSON配置，简单判断处理
    let vmessLink = "";
    if (decrypted.startsWith("vmess://")) {
      vmessLink = decrypted.trim();
    } else {
      // 尝试JSON转vmess链接
      let json = null;
      try {
        json = JSON.parse(decrypted);
      } catch (e) {
        throw new Error("解密内容不是有效JSON或vmess链接");
      }

      // 转成 vmess 链接格式
      const vmessObj = {
        v: "2",
        ps: json.ps || "节点",
        add: json.add || json.address || "unknown",
        port: json.port || "443",
        id: json.id || json.node_id || "",
        aid: json.aid || "0",
        scy: "auto",
        net: "ws",
        type: "none",
        host: json.host || json.add || json.address || "",
        path: json.path || "/",
        tls: "tls",
        sni: json.sni || "",
        alpn: "",
      };
      vmessLink = "vmess://" + Buffer.from(JSON.stringify(vmessObj)).toString("base64");
    }

    $.msg("✅ 解密成功", "", vmessLink);
    $.log(vmessLink);
  } catch (e) {
    $.msg("❌ 解密失败", "", e.message);
    $.logErr(e);
  } finally {
    $.done();
  }
})();
