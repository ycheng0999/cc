(async () => {
  // === 这里模拟接口返回数据（测试用） ===
  let body = {
    "remark": "成功",
    "result": {
      "code": "AUTO",
      "frame": 2,
      "id": 1093,
      "name": "香港",
      "type": 1,
      "url": "yhgLegqE3rorpuZk1OJh7ivVlGwTWb8lvw0MiYl0zGzV0n3e8yDAS8LJbLSieNlQeRgzicPrWky8eB/ZfP9lNa2LcsRJa+mzQbH+C8uqBKn3+sX0hylInKmNUoYxXua5TtyGJsd2My7Rf4huXmIkvxNsG03YbCPGengjWlBBRv4sy1ZhdmMMyPNRrPfwOXLpEjrmebGXp0LO4dd3QNkmd6+YGOI0YZsps8p8MAnut43yWjPyXmi5zURjBurXL3x1Jbv9eNGMOp+lkmZXr2BBxY9Om1RgwwKoBvAMFaiDSubqbC5MYP56+KcJytH5KSUWA7MD6IRoSAkUhpB0DRRhjVvSC41bPMATrJKKltyHTaGHg7kdDLMqFMhiXD2QRO20wp3iGvJehh/DuzCB6sU3kYQp006GEtUCOSuGocxBCPA="
    },
    "code": 200
  };
  // ================================

  const KEYS = [
    { key: "TmPrPhkOf8by0cvx", iv: "TmPrPhkOf8by0cvx" },
    { key: "929af8c0ac9dc557", iv: "929af8c0ac9dc557" },
    { key: "817a7baa5c74b982", iv: "817a7baa5c74b982" },
    { key: "5841b418488e65cc", iv: "5841b418488e65cc" },
    { key: "AE0plfOrl4CCUO87", iv: "AE0plfOrl4CCUO87" },
    { key: "VNfo9MuDNeP8ZjYm", iv: "VNfo9MuDNeP8ZjYm" }
  ];

  // 这里如果你在 Surge 等平台运行，替换为环境实例
  const $ = {
    msg: (t, s, b) => console.log(`[MSG] ${t} - ${s}\n${b}`),
    log: console.log,
    logErr: console.error,
    done: () => {}
  };

  try {
    // 你需要引入 CryptoJS 库，测试环境里可以用 nodejs crypto 或其他，线上自己保证 CryptoJS 可用
    const CryptoJS = await loadCryptoJS();

    const result = body?.result;
    if (!result || typeof result !== "object") throw new Error("未找到 result 字段");

    const nodeName = result?.name || "节点";

    // 要解密的字段列表，url 属于整体解密优先字段
    const fieldsToDecrypt = {
      address: "",
      port: "",
      path: "",
      node_id: "",
      url: ""
    };
    const overallFields = new Set(['url']);

    let failed = false;
    let overallDecryptedConfig = null;

    function decryptField(val) {
      if (typeof val !== "string" || !isProbablyEncrypted(val)) return null;
      const base64Str = decodeURIComponent(val);
      for (const { key, iv } of KEYS) {
        try {
          const k = CryptoJS.enc.Utf8.parse(key);
          const i = CryptoJS.enc.Utf8.parse(iv);
          const decrypted = AES_Decrypt(base64Str, k, i, CryptoJS);
          if (decrypted?.trim()) return decrypted;
        } catch {}
      }
      return null;
    }

    // 先解密所有字段
    for (const field in fieldsToDecrypt) {
      const raw = result[field];
      if (!raw) {
        $.log(`字段 ${field} 为空或不存在`);
        continue;
      }

      let decrypted = null;
      if (overallFields.has(field)) {
        decrypted = decryptField(raw);
        if (decrypted) overallDecryptedConfig = decrypted;
      } else {
        decrypted = decryptField(raw);
        if (decrypted) {
          fieldsToDecrypt[field] = decrypted;
        }
      }

      if (!decrypted && !overallDecryptedConfig) {
        $.log(`字段 ${field} 解密失败`);
        failed = true;
      }
    }

    if (overallDecryptedConfig) {
      $.msg("✅ 整体解密成功", "", overallDecryptedConfig);
      $.log("整体配置:\n" + overallDecryptedConfig);
      $.done();
      return;
    }

    if (failed) throw new Error("部分字段解密失败");

    const vmess = `${nodeName} = vmess, ${fieldsToDecrypt.address}, ${fieldsToDecrypt.port}, username=${fieldsToDecrypt.node_id}, ws=true, ws-path=${fieldsToDecrypt.path}, tls=true, skip-cert-verify=true, sni=${fieldsToDecrypt.address}`;
    $.msg("✅ 解密完成 + vmess ✅配置生成", "", vmess);
    $.log("配置：\n" + vmess);

  } catch (err) {
    $.logErr("❌ 出错", err);
    $.msg("VPN节点提取器", "配置生成失败", err.message);
  } finally {
    $.done();
  }

  function isProbablyEncrypted(str) {
    return /^[A-Za-z0-9+/=]{16,}$/.test(str);
  }

  function AES_Decrypt(data, key, iv, CryptoJS) {
    const decrypted = CryptoJS.AES.decrypt(data, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  // 这里用 CDN 动态加载 CryptoJS，或者你自己提供
  async function loadCryptoJS() {
    if (typeof CryptoJS !== "undefined") return CryptoJS;
    return new Promise((resolve, reject) => {
      if (typeof $httpClient !== "undefined") {
        $httpClient.get("https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.min.js", (err, resp, data) => {
          if (err) return reject(err);
          eval(data);
          resolve(CryptoJS);
        });
      } else if (typeof $task !== "undefined") {
        $task.fetch({ url: "https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.min.js" })
          .then(resp => {
            eval(resp.body);
            resolve(CryptoJS);
          }, reject);
      } else {
        reject("运行环境不支持自动加载 CryptoJS，请自行引入");
      }
    });
  }
})();
