// 简易香蕉VPN调试脚本
console.log("香蕉VPN: 开始解析");

try {
  const body = typeof $response.body === "string" ? $response.body : $response.body.toString();
  const json = JSON.parse(body);

  if (!json.bio_result_tron || !json.bio_result_tron.bio_link_url_tron) {
    console.log("香蕉VPN: 关键字段缺失");
  } else {
    console.log("香蕉VPN: 成功提取字段");
    console.log("节点内容(Base64):", json.bio_result_tron.bio_link_url_tron);
  }
} catch (e) {
  console.log("香蕉VPN脚本解析异常：", e.message);
}

$done({});