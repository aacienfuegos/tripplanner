import { db } from "./database";
import { listTrips, createTrip, deleteTrip } from "./trips";
import { createFlight } from "./flights";
import { createAccommodation } from "./accommodations";
import { createActivity } from "./activities";
import { createExpense } from "./expenses";
import { createPackingItem } from "./packing";
import { createDocument } from "./documents";
import { createTask } from "./tasks";
import { createDiveArea } from "./dive-areas";
import { createDiveSite } from "./dive-sites";
import { createDiveEquipment } from "./dive-equipment";
import { createDiveCertification } from "./dive-certifications";
import { createDiveLog } from "./dive-logs";

function iso(daysFromToday: number, time = "00:00:00"): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return `${d.toISOString().slice(0, 10)}T${time}`;
}
function day(daysFromToday: number): string {
  return iso(daysFromToday).slice(0, 10);
}

// trip_id en dive_logs es ON DELETE SET NULL (una inmersión sobrevive a su
// viaje), así que borrar los viajes no limpia el módulo de buceo — hay que
// vaciarlo aparte para no acumular datos de pruebas en cada reseed.
export function clearAllData(): void {
  for (const trip of listTrips()) deleteTrip(trip.id);
  db.execSync(`
    DELETE FROM dive_log_equipment;
    DELETE FROM dive_equipment_service;
    DELETE FROM dive_logs;
    DELETE FROM dive_equipment;
    DELETE FROM dive_certifications;
    DELETE FROM dive_sites;
    DELETE FROM dive_areas;
  `);
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

  // ─── Módulo de buceo: histórico propio, sin viaje asociado ────────────
  const redSea = createDiveArea({ name: "Mar Rojo", country: "Egipto", notes: null });
  const costaBrava = createDiveArea({ name: "Costa Brava", country: "España", notes: null });

  // Coordenadas reales fijas en vez de geocodificarlas en cada arranque —
  // el seed debe ser rápido, determinista y no depender de la red.
  const illesMedes = createDiveSite({
    dive_area_id: costaBrava.id, name: "Illes Medes",
    address: null, country: "España", region: "L'Estartit",
    latitude: 42.0463, longitude: 3.2205,
    notes: "Reserva marina, gran biodiversidad",
  });
  const capDeCreus = createDiveSite({
    dive_area_id: costaBrava.id, name: "Cap de Creus",
    address: null, country: "España", region: "Cadaqués",
    latitude: 42.3182, longitude: 3.3189, notes: null,
  });
  const blueHole = createDiveSite({
    dive_area_id: redSea.id, name: "Blue Hole",
    address: null, country: "Egipto", region: "Dahab",
    latitude: 28.5661, longitude: 34.5389,
    notes: "Entrada famosa por el arco a 56m, solo con formación técnica",
  });
  const thistlegorm = createDiveSite({
    dive_area_id: redSea.id, name: "SS Thistlegorm",
    address: null, country: "Egipto", region: "Sharm el-Sheij",
    latitude: 27.8125, longitude: 33.9200,
    notes: "Pecio de la Segunda Guerra Mundial",
  });

  const wetsuit = createDiveEquipment({
    name: "Traje 5mm Cressi", category: "WETSUIT", status: "OWNED",
    brand: "Cressi", model: "Fisherman", size: "L", serial_number: null,
    purchase_date: day(-800), purchase_price: 220,
    last_service_date: null, service_interval_months: null, notes: null,
  });
  const bcd = createDiveEquipment({
    name: "Chaleco Scubapro Hydros", category: "BCD", status: "OWNED",
    brand: "Scubapro", model: "Hydros Pro", size: "M", serial_number: "SP-88231",
    purchase_date: day(-700), purchase_price: 650,
    last_service_date: day(-400), service_interval_months: 12, notes: null,
  });
  const regulator = createDiveEquipment({
    name: "Regulador Apeks XTX50", category: "REGULATOR", status: "OWNED",
    brand: "Apeks", model: "XTX50", size: null, serial_number: "AX-55210",
    purchase_date: day(-700), purchase_price: 480,
    last_service_date: day(-450), service_interval_months: 12,
    notes: "Revisión anual obligatoria",
  });
  const computer = createDiveEquipment({
    name: "Ordenador Suunto D5", category: "COMPUTER", status: "OWNED",
    brand: "Suunto", model: "D5", size: null, serial_number: "SU-1120X",
    purchase_date: day(-500), purchase_price: 520,
    last_service_date: null, service_interval_months: null, notes: null,
  });
  const fins = createDiveEquipment({
    name: "Aletas Mares Avanti", category: "FINS", status: "OWNED",
    brand: "Mares", model: "Avanti Quattro", size: "42-43", serial_number: null,
    purchase_date: day(-700), purchase_price: 110,
    last_service_date: null, service_interval_months: null, notes: null,
  });
  createDiveEquipment({
    name: "Cámara GoPro Hero con housing", category: "CAMERA", status: "WISHLIST",
    brand: "GoPro", model: "Hero 12", size: null, serial_number: null,
    purchase_date: null, purchase_price: 450,
    last_service_date: null, service_interval_months: null,
    notes: "Para grabar los pecios del Mar Rojo",
  });


  createDiveCertification({
    agency: "PADI", level: "Open Water Diver", cert_number: "OW-88213",
    issue_date: day(-900), instructor_name: "Marco Bianchi", notes: null,
  });
  createDiveCertification({
    agency: "PADI", level: "Advanced Open Water Diver", cert_number: "AOW-91820",
    issue_date: day(-600), instructor_name: "Elena Vidal",
    notes: "Especialidad en pecios y profunda",
  });

  const fullGear = [wetsuit.id, bcd.id, regulator.id, computer.id, fins.id];

  createDiveLog({
    trip_id: null, dive_site_id: illesMedes.id, date: iso(-820, "10:00:00"),
    depth_max: 18, bottom_time: 42, surface_interval: null,
    gas_mix: "AIR", o2_percentage: null, helium_percentage: null,
    pressure_start: null, pressure_end: null,
    water_temp: 16, air_temp: 20, visibility: 10,
    dive_type: "RECREATIONAL", buddy_name: "Marco Bianchi", suit_type: "5mm húmedo",
    weight: 6, rating: 4, notes: "Primera inmersión certificada, agua fría pero buena visibilidad",
    equipmentIds: [],
  });
  createDiveLog({
    trip_id: null, dive_site_id: capDeCreus.id, date: iso(-600, "09:30:00"),
    depth_max: 24, bottom_time: 38, surface_interval: null,
    gas_mix: "AIR", o2_percentage: null, helium_percentage: null,
    pressure_start: 210, pressure_end: 60,
    water_temp: 18, air_temp: 22, visibility: 12,
    dive_type: "DRIFT", buddy_name: "Elena Vidal", suit_type: "5mm húmedo",
    weight: 5, rating: 5, notes: null,
    equipmentIds: [fins.id],
  });
  createDiveLog({
    trip_id: null, dive_site_id: illesMedes.id, date: iso(-450, "21:00:00"),
    depth_max: 15, bottom_time: 35, surface_interval: null,
    gas_mix: "AIR", o2_percentage: null, helium_percentage: null,
    pressure_start: 200, pressure_end: 70,
    water_temp: 19, air_temp: 21, visibility: 8,
    dive_type: "NIGHT", buddy_name: "Elena Vidal", suit_type: "5mm húmedo",
    weight: 5, rating: 5, notes: "Pulpos y nudibranquios por todas partes",
    equipmentIds: fullGear,
  });
  createDiveLog({
    trip_id: null, dive_site_id: blueHole.id, date: iso(-40, "08:15:00"),
    depth_max: 32, bottom_time: 28, surface_interval: 65,
    gas_mix: "NITROX", o2_percentage: 32, helium_percentage: null,
    pressure_start: 200, pressure_end: 60,
    water_temp: 26, air_temp: 32, visibility: 25,
    dive_type: "DEEP", buddy_name: "Ahmed Hassan", suit_type: "3mm húmedo",
    weight: 4, rating: 5, notes: "El arco impresionante, muy buena visibilidad",
    equipmentIds: fullGear,
  });
  createDiveLog({
    trip_id: null, dive_site_id: thistlegorm.id, date: iso(-38, "09:00:00"),
    depth_max: 28, bottom_time: 45, surface_interval: null,
    gas_mix: "NITROX", o2_percentage: 32, helium_percentage: null,
    pressure_start: 210, pressure_end: 50,
    water_temp: 27, air_temp: 33, visibility: 20,
    dive_type: "WRECK", buddy_name: "Ahmed Hassan", suit_type: "3mm húmedo",
    weight: 4, rating: 5, notes: "Motos y camiones aún visibles en las bodegas",
    equipmentIds: fullGear,
  });
  createDiveLog({
    trip_id: null, dive_site_id: illesMedes.id, date: iso(-5, "10:30:00"),
    depth_max: 20, bottom_time: 40, surface_interval: null,
    gas_mix: "AIR", o2_percentage: null, helium_percentage: null,
    pressure_start: 205, pressure_end: 65,
    water_temp: 17, air_temp: 20, visibility: 14,
    dive_type: "RECREATIONAL", buddy_name: "Marco Bianchi", suit_type: "5mm húmedo",
    weight: 6, rating: 4, notes: null,
    equipmentIds: fullGear,
  });
}
