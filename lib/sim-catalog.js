const ALL_OTISTX_CARRIERS = [
  "viettel",
  "vinaphone",
  "mobifone",
  "vnmb",
  "gmobile",
  "main_3",
  "random",
  "itel",
];

export const SIM_CARRIER_LABELS = {
  viettel: "Viettel",
  vinaphone: "VinaPhone",
  mobifone: "MobiFone",
  vnmb: "Vietnamobile",
  gmobile: "Gmobile",
  main_3: "Main 3",
  random: "Ngẫu nhiên",
  itel: "iTel",
};

export const SIM_SERVICE_CATALOG = [
  {
    id: "otissim_v1",
    label: "OtisSim v1",
    mode: "No-check",
    description: "Mode no-check: provider trả số chưa kiểm tra trạng thái đăng ký.",
    carriers: ALL_OTISTX_CARRIERS,
  },
  {
    id: "otissim_v2",
    label: "OtisSim v2",
    mode: "Check số",
    description: "Có kiểm tra trạng thái số theo luồng hiện tại của provider.",
    carriers: ALL_OTISTX_CARRIERS,
  },
  {
    id: "otissim_v3",
    label: "OtisSim v3",
    mode: "Check số",
    description: "Có kiểm tra trạng thái số theo luồng hiện tại của provider.",
    carriers: ALL_OTISTX_CARRIERS,
  },
  {
    id: "otissim_v4",
    label: "OtisSim v4",
    mode: "Check số",
    description: "Có kiểm tra trạng thái số; hỗ trợ Vietnamobile và Gmobile.",
    carriers: ["vnmb", "gmobile"],
  },
  {
    id: "otissim_v5",
    label: "OtisSim v5",
    mode: "No-check",
    description: "Mode no-check: provider trả số chưa kiểm tra trạng thái đăng ký.",
    carriers: ["vnmb", "gmobile"],
  },
  {
    id: "otissim_v6",
    label: "OtisSim v6",
    mode: "Check số",
    description: "Luồng tương tự OtisSim v4; chỉ hỗ trợ Vietnamobile.",
    carriers: ["vnmb"],
  },
];

export const VIOTP_CARRIERS = ["viettel", "vinaphone", "mobifone", "vnmb", "itel", "random"];

export const SIM_SERVICES = SIM_SERVICE_CATALOG.map(({ id }) => id);

export function getSupportedCarriers(serviceId, provider = "otistx") {
  const service = SIM_SERVICE_CATALOG.find(({ id }) => id === serviceId);
  if (!service) return [];
  if (provider === "otistx") return service.carriers;
  if (provider === "viotp") return service.carriers.filter((carrier) => VIOTP_CARRIERS.includes(carrier));
  return [];
}