import type { WebTKeys } from "@/i18n";
import type { EquipmentCategory, EquipmentStatus } from "@/types";

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  "WETSUIT",
  "BCD",
  "REGULATOR",
  "COMPUTER",
  "FINS",
  "MASK",
  "TANK",
  "WEIGHT",
  "TORCH",
  "CAMERA",
  "OTHER",
];

export const EQUIPMENT_STATUSES: EquipmentStatus[] = ["OWNED", "WISHLIST", "RETIRED", "SOLD"];

export function equipmentCategoryLabels(t: WebTKeys): Record<EquipmentCategory, string> {
  return {
    WETSUIT: t.equipmentCategoryWetsuit,
    BCD: t.equipmentCategoryBcd,
    REGULATOR: t.equipmentCategoryRegulator,
    COMPUTER: t.equipmentCategoryComputer,
    FINS: t.equipmentCategoryFins,
    MASK: t.equipmentCategoryMask,
    TANK: t.equipmentCategoryTank,
    WEIGHT: t.equipmentCategoryWeight,
    TORCH: t.equipmentCategoryTorch,
    CAMERA: t.equipmentCategoryCamera,
    OTHER: t.equipmentCategoryOther,
  };
}

export function equipmentCategoryLabel(value: EquipmentCategory, t: WebTKeys): string {
  return equipmentCategoryLabels(t)[value];
}

export function equipmentStatusLabels(t: WebTKeys): Record<EquipmentStatus, string> {
  return {
    OWNED: t.equipmentStatusOwned,
    WISHLIST: t.equipmentStatusWishlist,
    RETIRED: t.equipmentStatusRetired,
    SOLD: t.equipmentStatusSold,
  };
}
