import { listTrips, createTrip, deleteTrip } from "./trips";
import { createFlight } from "./flights";
import { createAccommodation } from "./accommodations";
import { createActivity } from "./activities";
import { createExpense } from "./expenses";
import { createPackingItem } from "./packing";
import { createDocument } from "./documents";
import { createTask } from "./tasks";

function iso(daysFromToday: number, time = "00:00:00"): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return `${d.toISOString().slice(0, 10)}T${time}`;
}
function day(daysFromToday: number): string {
  return iso(daysFromToday).slice(0, 10);
}

export function clearAllData(): void {
  for (const trip of listTrips()) deleteTrip(trip.id);
}

// Tres viajes (futuro, en curso y pasado) para poder ver todos los estados
// de UI (countdown, progreso, timeline con "hoy", trip pasado) sin tener que
// rellenar formularios a mano. Usa las funciones create* reales (no SQL
// directo) para que el cifrado de campos sensibles (#182) se aplique igual
// que en producción.
export async function seedDevData(): Promise<void> {
  clearAllData();

  // ─── Viaje futuro: Japón ──────────────────────────────────────────────
  const japan = createTrip({
    name: "Japón: Tokio y Kioto",
    description: "Dos semanas entre neones y templos",
    start_date: day(45),
    end_date: day(58),
    currency: "EUR",
    budget: 3200,
  });

  await createFlight(japan.id, {
    airline: "Iberia", flight_number: "IB6800",
    origin: "MAD", destination: "NRT",
    departure_at: iso(45, "13:20:00"), arrival_at: iso(46, "09:15:00"),
    booking_ref: "QZX7K2", confirmation_url: "https://iberia.com/mytrips/QZX7K2",
    seat_number: "23A", class: "ECONOMY", price: 780,
    notes: "Escala en Frankfurt, 1h50 de conexión",
  });
  await createFlight(japan.id, {
    airline: "ANA", flight_number: "NH216",
    origin: "KIX", destination: "MAD",
    departure_at: iso(58, "11:05:00"), arrival_at: iso(58, "18:40:00"),
    booking_ref: "QZX7K2", confirmation_url: "https://ana.co.jp/mytrips/QZX7K2",
    seat_number: "31C", class: "ECONOMY", price: 810,
    notes: null,
  });

  await createAccommodation(japan.id, {
    name: "Shinjuku Granbell Hotel", type: "HOTEL",
    address: "2-14-5 Kabukicho", city: "Tokio",
    check_in: day(46), check_out: day(52),
    booking_ref: "BK-9931827", confirmation_url: "https://booking.com/res/9931827",
    price: 1080, price_per_night: 180,
    notes: "Pedir habitación en planta alta si hay disponibilidad",
  });
  await createAccommodation(japan.id, {
    name: "Kyoto Machiya Residence Inn", type: "APARTMENT",
    address: "Nakagyo-ku", city: "Kioto",
    check_in: day(52), check_out: day(58),
    booking_ref: "BK-4471029", confirmation_url: "https://booking.com/res/4471029",
    price: 720, price_per_night: 120,
    notes: null,
  });

  await createActivity(japan.id, {
    name: "TeamLab Planets", type: "MUSEUM",
    description: "Museo de arte digital inmersivo",
    location: "Toyosu", city: "Tokio",
    scheduled_at: iso(47, "10:00:00"), duration: 120,
    booking_ref: "TLB-5521", confirmation_url: "https://teamlab.art/e/planets/5521",
    price: 38, status: "CONFIRMED",
    notes: "Llevar toalla, hay zonas con agua",
  });
  await createActivity(japan.id, {
    name: "Tour gastronómico en Shibuya", type: "TOUR",
    description: "Izakayas y street food con guía local",
    location: "Shibuya", city: "Tokio",
    scheduled_at: iso(48, "18:30:00"), duration: 180,
    booking_ref: null, confirmation_url: null,
    price: 95, status: "RESERVED",
    notes: null,
  });
  await createActivity(japan.id, {
    name: "Fushimi Inari-taisha", type: "ACTIVITY",
    description: "Santuario de los mil torii",
    location: "Fushimi-ku", city: "Kioto",
    scheduled_at: iso(53, "07:30:00"), duration: 150,
    booking_ref: null, confirmation_url: null,
    price: null, status: "PENDING",
    notes: "Ir temprano para evitar aglomeraciones",
  });
  await createActivity(japan.id, {
    name: "Comida sin fecha cerrada: Ichiran ramen", type: "RESTAURANT",
    description: null, location: null, city: "Kioto",
    scheduled_at: null, duration: null,
    booking_ref: null, confirmation_url: null,
    price: null, status: "PENDING", notes: null,
  });

  await createDocument(japan.id, {
    name: "Pasaporte Andres Cienfuegos", type: "PASSPORT",
    expires_at: day(730), notes: "Nº ESP-847162930",
  });
  await createDocument(japan.id, {
    name: "Seguro de viaje Mapfre", type: "INSURANCE",
    expires_at: day(58), notes: "Póliza VJ-2026-88213, tel. emergencia +34 900 123 456",
  });

  await createExpense(japan.id, { description: "Vuelos IB+ANA", category: "FLIGHT", amount: 1590, currency: "EUR", date: day(0), paid: 1, notes: null });
  await createExpense(japan.id, { description: "Hotel Shinjuku", category: "ACCOMMODATION", amount: 1080, currency: "EUR", date: day(0), paid: 1, notes: null });
  await createExpense(japan.id, { description: "Japan Rail Pass 14 días", category: "TRANSPORT", amount: 420, currency: "EUR", date: day(0), paid: 0, notes: null });
  await createExpense(japan.id, { description: "TeamLab Planets", category: "ACTIVITY", amount: 38, currency: "EUR", date: iso(47).slice(0, 10), paid: 0, notes: null });

  await createPackingItem(japan.id, { name: "Adaptador de corriente tipo A", category: "Electrónica", quantity: 2, packed: 1 });
  await createPackingItem(japan.id, { name: "Power bank", category: "Electrónica", quantity: 1, packed: 1 });
  await createPackingItem(japan.id, { name: "Zapatillas cómodas", category: "Ropa", quantity: 2, packed: 0 });
  await createPackingItem(japan.id, { name: "Efectivo en yenes", category: "Documentos", quantity: 1, packed: 0 });

  createTask(japan.id, { title: "Tramitar JR Pass online", notes: null, due_date: day(30), priority: "HIGH", done: 0 });
  createTask(japan.id, { title: "Descargar mapas offline de Tokio y Kioto", notes: null, due_date: day(44), priority: "MEDIUM", done: 0 });
  createTask(japan.id, { title: "Avisar al banco del viaje", notes: "Para evitar bloqueo de tarjeta", due_date: day(40), priority: "MEDIUM", done: 1 });

  // ─── Viaje en curso: Lisboa ───────────────────────────────────────────
  const lisbon = createTrip({
    name: "Escapada a Lisboa",
    description: "Fin de semana largo",
    start_date: day(-2),
    end_date: day(2),
    currency: "EUR",
    budget: 600,
  });

  await createFlight(lisbon.id, {
    airline: "TAP Portugal", flight_number: "TP1012",
    origin: "MAD", destination: "LIS",
    departure_at: iso(-2, "07:45:00"), arrival_at: iso(-2, "08:50:00"),
    booking_ref: "LX88PT", confirmation_url: "https://flytap.com/mytrips/LX88PT",
    seat_number: "14F", class: "ECONOMY", price: 145,
    notes: null,
  });
  await createFlight(lisbon.id, {
    airline: "TAP Portugal", flight_number: "TP1019",
    origin: "LIS", destination: "MAD",
    departure_at: iso(2, "20:10:00"), arrival_at: iso(2, "23:35:00"),
    booking_ref: "LX88PT", confirmation_url: "https://flytap.com/mytrips/LX88PT",
    seat_number: "14F", class: "ECONOMY", price: 150,
    notes: null,
  });

  await createAccommodation(lisbon.id, {
    name: "Alfama Patio Hostel", type: "HOSTEL",
    address: "Rua de São Pedro", city: "Lisboa",
    check_in: day(-2), check_out: day(2),
    booking_ref: "BK-2210984", confirmation_url: "https://booking.com/res/2210984",
    price: 280, price_per_night: 70,
    notes: null,
  });

  await createActivity(lisbon.id, {
    name: "Miradouro da Senhora do Monte", type: "ACTIVITY",
    description: "Atardecer con vistas a la ciudad",
    location: "Graça", city: "Lisboa",
    scheduled_at: iso(-1, "19:30:00"), duration: 60,
    booking_ref: null, confirmation_url: null,
    price: null, status: "CONFIRMED", notes: null,
  });
  await createActivity(lisbon.id, {
    name: "Excursión a Sintra", type: "TOUR",
    description: "Palacio da Pena y Quinta da Regaleira",
    location: "Sintra", city: "Sintra",
    scheduled_at: iso(1, "09:00:00"), duration: 480,
    booking_ref: "GYG-33210", confirmation_url: "https://getyourguide.com/res/33210",
    price: 65, status: "CONFIRMED", notes: "Punto de encuentro: Rossio 8:50",
  });

  await createExpense(lisbon.id, { description: "Vuelos TAP", category: "FLIGHT", amount: 295, currency: "EUR", date: day(-10), paid: 1, notes: null });
  await createExpense(lisbon.id, { description: "Hostel Alfama", category: "ACCOMMODATION", amount: 280, currency: "EUR", date: day(-10), paid: 1, notes: null });
  await createExpense(lisbon.id, { description: "Cena en Time Out Market", category: "FOOD", amount: 42, currency: "EUR", date: day(-1), paid: 1, notes: null });
  await createExpense(lisbon.id, { description: "Excursión Sintra", category: "ACTIVITY", amount: 65, currency: "EUR", date: day(0), paid: 0, notes: null });

  await createPackingItem(lisbon.id, { name: "Paraguas", category: "Ropa", quantity: 1, packed: 1 });
  await createPackingItem(lisbon.id, { name: "Cámara", category: "Electrónica", quantity: 1, packed: 1 });

  createTask(lisbon.id, { title: "Reservar mesa en Time Out Market", notes: null, due_date: day(-1), priority: "LOW", done: 1 });

  // ─── Viaje pasado: Roma ───────────────────────────────────────────────
  const rome = createTrip({
    name: "Roma en primavera",
    description: "Viaje de aniversario",
    start_date: day(-120),
    end_date: day(-115),
    currency: "EUR",
    budget: 900,
  });

  await createFlight(rome.id, {
    airline: "Vueling", flight_number: "VY6201",
    origin: "MAD", destination: "FCO",
    departure_at: iso(-120, "10:15:00"), arrival_at: iso(-120, "12:05:00"),
    booking_ref: "RM209X", confirmation_url: null,
    seat_number: null, class: "ECONOMY", price: 110,
    notes: null,
  });

  await createAccommodation(rome.id, {
    name: "Hotel Trastevere", type: "HOTEL",
    address: "Via della Lungaretta", city: "Roma",
    check_in: day(-120), check_out: day(-115),
    booking_ref: "BK-1178320", confirmation_url: null,
    price: 620, price_per_night: 124,
    notes: null,
  });

  await createActivity(rome.id, {
    name: "Coliseo + Foro Romano", type: "MUSEUM",
    description: "Entrada con acceso al Coliseo, Foro y Palatino",
    location: "Centro Storico", city: "Roma",
    scheduled_at: iso(-119, "09:00:00"), duration: 240,
    booking_ref: "COL-7743", confirmation_url: null,
    price: 24, status: "CONFIRMED", notes: null,
  });

  await createExpense(rome.id, { description: "Vuelos Vueling", category: "FLIGHT", amount: 220, currency: "EUR", date: day(-140), paid: 1, notes: null });
  await createExpense(rome.id, { description: "Hotel Trastevere", category: "ACCOMMODATION", amount: 620, currency: "EUR", date: day(-140), paid: 1, notes: null });
  await createExpense(rome.id, { description: "Cena de aniversario", category: "FOOD", amount: 88, currency: "EUR", date: day(-116), paid: 1, notes: "Restaurante Roscioli" });

  createTask(rome.id, { title: "Imprimir entradas del Coliseo", notes: null, due_date: day(-121), priority: "MEDIUM", done: 1 });
}
