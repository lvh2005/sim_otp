const ALL_OTISTX_CARRIERS = [
  "random",
  "viettel",
  "vinaphone",
  "mobifone",
  "vnmb",
  "gmobile",
  "itel",
  "main_3",
];

export const SIM_CARRIER_LABELS = {
  random: "Ngẫu nhiên (Tất cả)",
  viettel: "Viettel",
  vinaphone: "VinaPhone",
  mobifone: "MobiFone",
  vnmb: "Vietnamobile",
  gmobile: "Gmobile",
  itel: "iTel",
  wintel: "Wintel",
  main_3: "Main 3",
  "8500": "Gateway 8500",
  "7539": "Gateway 7539",
};

export const SIM_SERVICE_CATALOG = [
  {
    id: "otissim_v1",
    label: "SIM OTP 01",
    mode: "No-check",
    description: "Gói no-check tiêu chuẩn: Nhận mã OTP trực tiếp, tốc độ cao cho đa số nhu cầu.",
    carriers: ALL_OTISTX_CARRIERS,
  },
  {
    id: "otissim_v2",
    label: "SIM OTP 02",
    mode: "Check số",
    description: "Có kiểm tra trạng thái số trước khi cấp, hạn chế trùng số tối đa.",
    carriers: ALL_OTISTX_CARRIERS,
  },
  {
    id: "otissim_v3",
    label: "SIM OTP 03",
    mode: "Check số",
    description: "Luồng kiểm tra số tự động theo thời gian thực, độ ổn định cao.",
    carriers: ALL_OTISTX_CARRIERS,
  },
  {
    id: "otissim_v4",
    label: "SIM OTP 04",
    mode: "Check số",
    description: "Gói kiểm tra số tối ưu; hỗ trợ Vietnamobile và Gmobile.",
    carriers: ["vnmb", "gmobile"],
  },
  {
    id: "otissim_v5",
    label: "SIM OTP 05",
    mode: "No-check",
    description: "Gói no-check tốc độ cao; hỗ trợ Vietnamobile và Gmobile.",
    carriers: ["vnmb", "gmobile"],
  },
  {
    id: "otissim_v6",
    label: "SIM OTP 06",
    mode: "Check số",
    description: "Gói kiểm tra số chuyên biệt cho mạng Vietnamobile.",
    carriers: ["vnmb"],
  },
  {
    id: "otissim_v7",
    label: "SIM OTP 07",
    mode: "Check số",
    category: "shopee",
    description: "Gói SIM OTP V7 - SIM Việt Nam tốc độ cao, nhận mã tức thì.",
    carriers: ["random"],
  },
  {
    id: "otissim_v8",
    label: "SIM OTP V8 VIP",
    mode: "Check số",
    category: "shopee",
    description: "Gói SIM OTP V8 VIP - Cổng SIMOTP VIP siêu tốc, cấp số tức thì, hỗ trợ hủy & hoàn tiền ngay.",
    carriers: ["random"],
  },
  {
    id: "shopee_f02",
    label: "Shopee Đá Số",
    mode: "Check số",
    category: "shopee",
    description: "Cổng SIMOTP V7: Cấp số nhận mã OTP Shopee Đá Số tốc độ cao.",
    carriers: ["random"],
  },
  {
    id: "sms_combo",
    label: "Gửi SMS & Nhận OTP",
    mode: "Gửi SMS",
    category: "other",
    description: "Cổng gsmotp5s: Gửi tin nhắn SMS đến số người nhận và nhận mã OTP phản hồi. Lưu ý: Không áp dụng hoàn tiền vì SIM đã gửi tin nhắn đi.",
    carriers: ["random"],
  },
  {
    id: "zalo",
    label: "Tạo Acc Zalo (8500 / 7539)",
    mode: "Tạo Acc",
    category: "other",
    description: "Tạo tài khoản Zalo qua 2 đầu số 8500 và 7539. Sau khi ấn Tạo (đã gửi SMS), không áp dụng hoàn tiền.",
    carriers: ["8500", "7539"],
  },
  {
    id: "simotp_tiktok_v1",
    label: "SIM OTP TikTok V1",
    mode: "Check số",
    category: "tiktok",
    description: "SIM OTP TikTok V1 - Thuê số Việt Nam đăng ký và xác thực tài khoản TikTok tốc độ cao từ cổng ViOTP.",
    carriers: ["random", "viettel", "vinaphone", "mobifone", "vnmb", "itel", "wintel"],
  },
];

export const VIOTP_CARRIERS = ["random", "viettel", "vinaphone", "mobifone", "vnmb", "itel", "wintel"];
export const OTPHUB_CARRIERS = ["random", "viettel", "vinaphone", "mobifone", "vnmb", "itel", "wintel"];
export const ZALO_GATEWAYS = ["8500", "7539"];

export const SIM_SERVICES = SIM_SERVICE_CATALOG.map(({ id }) => id);

export function getSupportedCarriers(serviceId, provider = "otistx") {
  const service = SIM_SERVICE_CATALOG.find(({ id }) => id === serviceId);
  if (!service) return [];
  if (serviceId === "zalo" || serviceId === "zalo_create") return ZALO_GATEWAYS;
  if (serviceId === "shopee_f02" || serviceId === "sms_combo" || serviceId === "otissim_v8" || provider === "otphub" || provider === "gsmotp5s") {
    return service.carriers.filter((carrier) => OTPHUB_CARRIERS.includes(carrier));
  }
  if (serviceId === "otissim_v7" || serviceId === "simotp_tiktok_v1" || provider === "viotp") {
    return service.carriers.filter((carrier) => VIOTP_CARRIERS.includes(carrier));
  }
  if (provider === "otistx") return service.carriers;
  return service.carriers || [];
}