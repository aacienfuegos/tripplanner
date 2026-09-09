interface ServiceableEquipment {
  lastServiceDate: Date | null;
  serviceIntervalMonths: number | null;
}

export function isServiceDue(equipment: ServiceableEquipment): boolean {
  if (!equipment.lastServiceDate || !equipment.serviceIntervalMonths) return false;
  const dueDate = new Date(equipment.lastServiceDate);
  dueDate.setMonth(dueDate.getMonth() + equipment.serviceIntervalMonths);
  return dueDate <= new Date();
}
