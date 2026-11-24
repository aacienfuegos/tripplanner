import { fakeDb } from "./fake-packing-db";

// The session user is OWNER (see the auth mock of each test). OTHER owns
// trip-other with its own bag and item: the ids an attacker would send.
export const OWNER = "user-owner";
export const OTHER = "user-other";

export function seedPacking() {
  fakeDb.reset({
    user: [{ id: OWNER }, { id: OTHER }],
    trip: [
      { id: "trip-own", userId: OWNER },
      { id: "trip-own-2", userId: OWNER },
      { id: "trip-other", userId: OTHER },
    ],
    suitcase: [
      { id: "s-cabin", tripId: "trip-own", name: "Cabina", type: "CABIN", weightGrams: 8000 },
      { id: "s-big", tripId: "trip-own", name: "Grande", type: "CHECKED" },
      { id: "s-own-2", tripId: "trip-own-2", name: "cabina", type: "BACKPACK" },
      { id: "s-other", tripId: "trip-other", name: "Ajena", type: "CABIN" },
    ],
    packingItem: [
      { id: "i-1", tripId: "trip-own", suitcaseId: "s-cabin", category: "Aseo", name: "Cepillo de dientes", packed: true },
      { id: "i-2", tripId: "trip-own", suitcaseId: "s-cabin", category: "Ropa", name: "Camiseta", quantity: 2 },
      { id: "i-3", tripId: "trip-own", suitcaseId: null, category: "Varios", name: "Cargador", packed: true },
      { id: "i-4", tripId: "trip-own", suitcaseId: "s-big", category: "Ropa", name: "Chaqueta", packed: true },
      { id: "i-other", tripId: "trip-other", suitcaseId: "s-other", category: "Ropa", name: "Ajeno", packed: true },
    ],
    diveEquipment: [
      { userId: OWNER, name: "Aletas" },
      { userId: OWNER, name: "Máscara" },
      { userId: OTHER, name: "Regulador" },
    ],
  });
}
