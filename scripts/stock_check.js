/*
 * 🍎 iPhone 17 Pro Max 大陆直营店库存监控
 * 目标门店: R389 Apple 浦东 (上海国金中心 IFC)
 * 作者: 基于 gginin.de/surge/scripts/iphone_check_store.js 改编
 *
 * 使用说明:
 *   在 Surge 的 [Script] 段添加定时任务，建议每 5 分钟触发一次：
 *   iPhone17ProMax_Check = type=cron,cronexp="*/5 6-21 * * *",script-path=path/to/this.js
 *
 *   在另一个脚本（或首次运行前）写入目标机型 Part Number：
 *   $persistentStore.write("MG034CH/A", "iPhoneModel");
 *
 * iPhone 17 Pro Max 大陆版 Part Numbers (A3527):
 *   颜色       | 容量  | Part Number
 *   银色        | 256G | MG034CH/A
 *   银色        | 512G | MG064CH/A
 *   银色        | 1TB  | MG094CH/A
 *   银色        | 2TB  | MG0F4CH/A
 *   深蓝色      | 256G | MG054CH/A
 *   宇宙橙色    | 256G | (见 Apple 官网，格式相同)
 */

const model = $persistentStore.read("iPhoneModel");

// R389 = Apple 浦东 (上海国金中心 IFC)
// 如需多监控其他大陆门店，在此数组追加 Store Code
const stores = ["R389"];

var checkRequest = {
  url: "",
  headers: {
    "User-Agent": "Apple Store/6.5.1 iOS/18.6.2 iPhone/iPhone16,2",
    "X-Ma-Pcmh": "REL-6.5.1",
    "X-Deviceconfiguration":
      "ss=3.00;dim=0x0;m=iPhone;v=iPhone16,2;vv=6.5.1;sv=18.6.2",
    "Accept-Language": "zh-CN,zh;q=0.9",
  },
};

// 递归检查每个门店
function checkStore(model, index) {
  const store = stores[index];
  checkRequest["url"] =
    "https://mobileapp.apple.com/fulfillment/p/cn/pickup/quote/" +
    encodeURIComponent(model) +
    "?partNumber=" +
    encodeURIComponent(model) +
    "&store=" +
    store;

  $httpClient.get(checkRequest, function (error, response, data) {
    if (error) {
      console.log("❌ 请求失败: " + error);
      $notification.post("🍎 库存检查失败", store, "网络连接错误，请检查节点");
      $done();
      return;
    }

    if (response.status === 200) {
      let obj;
      try {
        obj = JSON.parse(data);
      } catch (e) {
        console.log("❌ JSON 解析失败: " + data);
        $done();
        return;
      }

      if (obj.availabilityStatus && obj.availabilityStatus !== "NOT_AVAILABLE") {
        // 🎉 有货！立即推送通知
        $notification.post(
          `📱 ${model} 有货！`,
          `🏬 门店: Apple 浦东 (${store})`,
          obj.pickupQuote || "可以到店取货，请立即下单！"
        );
        console.log(`✅ ${store} 有货: ${obj.pickupQuote}`);
      } else {
        // 无货，只写日志，不打扰用户
        console.log(
          `⛔ ${store} 无货: ${obj.pickupQuote || "NOT_AVAILABLE"}`
        );
      }

      // 继续检查下一个门店
      if (index < stores.length - 1) {
        checkStore(model, index + 1);
      } else {
        $done();
      }
    } else {
      console.log(`❌ HTTP ${response.status} from ${store}`);
      $notification.post(
        "🍎 库存检查失败",
        store,
        `服务器返回 ${response.status}`
      );
      $done();
    }
  });
}

// ——— 执行入口 ———

// 检查是否已设置 Part Number
if (!model || model.trim() === "") {
  $notification.post(
    "⚠️ 未设置机型",
    "",
    "请先执行: $persistentStore.write('MG034CH/A', 'iPhoneModel')"
  );
  $done();
}
// 还没开售（2025年9月19日 08:00 UTC+8 = 1758225600000 ms）
else if (Date.now() < 1758225600000) {
  console.log("⏳ 还没开售，等待中…");
  $done();
}
// 非营业时间（10:00 - 22:00，Apple 浦东官网公布）
else if (new Date().getHours() < 10 || new Date().getHours() >= 22) {
  console.log("🕙 非营业时间（营业时间 10:00 - 22:00），跳过检查");
  $done();
}
// 正式开始检查
else {
  console.log(`🔍 开始检查 ${model} 在 ${stores.join(", ")} 的库存…`);
  checkStore(model, 0);
}
