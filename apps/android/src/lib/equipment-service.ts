// Port literal de apps/web/src/lib/equipment-service.ts
interface ServiceableEquipment {
  last_service_date: string | null;
  service_interval_months: number | null;
}

export function isServiceDue(equipment: ServiceableEquipment): boolean {
  if (!equipment.last_service_date || !equipment.service_interval_months) return false;
  const dueDate = new Date(equipment.last_service_date);
  dueDate.setMonth(dueDate.getMonth() + equipment.service_interval_months);
  return dueDate <= new Date();
}
