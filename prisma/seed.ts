import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEV_USER_ID = "dev-local-user-001";

async function main() {
  // Usuario dev
  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    update: {},
    create: {
      id: DEV_USER_ID,
      email: "admin@dev.local",
      name: "Andrés García",
      status: "APPROVED",
      isAdmin: true,
    },
  });

  // Limpia datos anteriores del usuario dev
  await prisma.trip.deleteMany({ where: { userId: DEV_USER_ID } });

  // ─── VIAJE 1: Japón (futuro, en 3 semanas) ────────────────────────────────
  const japon = await prisma.trip.create({
    data: {
      userId: DEV_USER_ID,
      name: "Japón - Cerezos en flor",
      description: "Tokio, Kioto y Osaka coincidiendo con el hanami. Sueño cumplido.",
      startDate: new Date("2026-06-07"),
      endDate: new Date("2026-06-21"),
      status: "BOOKED",
      currency: "JPY",
      budget: 350000,
      destinations: {
        create: [
          { city: "Tokio", country: "Japón", arrivalDate: new Date("2026-06-07"), departureDate: new Date("2026-06-12"), order: 1 },
          { city: "Kioto", country: "Japón", arrivalDate: new Date("2026-06-12"), departureDate: new Date("2026-06-17"), order: 2 },
          { city: "Osaka", country: "Japón", arrivalDate: new Date("2026-06-17"), departureDate: new Date("2026-06-21"), order: 3 },
        ],
      },
      flights: {
        create: [
          {
            airline: "Iberia",
            flightNumber: "IB6841",
            origin: "MAD",
            destination: "NRT",
            departureAt: new Date("2026-06-07T10:30:00"),
            arrivalAt: new Date("2026-06-08T07:15:00"),
            bookingRef: "XJQP72",
            class: "ECONOMY",
            seatNumber: "34A",
            price: 780,
            notes: "Escala en Helsinki 2h. Llevar snacks.",
          },
          {
            airline: "Japan Airlines",
            flightNumber: "JL311",
            origin: "OSA",
            destination: "MAD",
            departureAt: new Date("2026-06-21T14:00:00"),
            arrivalAt: new Date("2026-06-22T19:45:00"),
            bookingRef: "XJQP73",
            class: "ECONOMY",
            seatNumber: "22C",
            price: 820,
          },
          {
            airline: "Shinkansen",
            flightNumber: "Nozomi 15",
            origin: "Tokio",
            destination: "Kioto",
            departureAt: new Date("2026-06-12T09:00:00"),
            arrivalAt: new Date("2026-06-12T11:17:00"),
            bookingRef: "SHK-0612",
            class: "ECONOMY",
            price: 140,
            notes: "Tren bala. Reservar asiento con antelación.",
          },
        ],
      },
      accommodations: {
        create: [
          {
            name: "Shinjuku Granbell Hotel",
            type: "HOTEL",
            city: "Tokio",
            address: "2-14-5 Kabukicho, Shinjuku-ku, Tokyo",
            checkIn: new Date("2026-06-07"),
            checkOut: new Date("2026-06-12"),
            bookingRef: "BKG-38821",
            confirmationUrl: "https://booking.com/confirmation/38821",
            pricePerNight: 12000,
            price: 60000,
            notes: "Check-in desde las 15:00. Desayuno incluido.",
          },
          {
            name: "Kyoto Machiya Guesthouse",
            type: "AIRBNB",
            city: "Kioto",
            address: "46-16 Anenishicho, Nakagyo-ku, Kyoto",
            checkIn: new Date("2026-06-12"),
            checkOut: new Date("2026-06-17"),
            bookingRef: "AIR-KYO884",
            pricePerNight: 9500,
            price: 47500,
            notes: "Casa tradicional machiya. El anfitrión habla inglés.",
          },
          {
            name: "Cross Hotel Osaka",
            type: "HOTEL",
            city: "Osaka",
            address: "2-5-15 Shinsaibashisuji, Chuo-ku, Osaka",
            checkIn: new Date("2026-06-17"),
            checkOut: new Date("2026-06-21"),
            bookingRef: "BKG-90341",
            pricePerNight: 8000,
            price: 32000,
          },
        ],
      },
      activities: {
        create: [
          {
            name: "Visita al Templo Senso-ji",
            type: "MUSEUM",
            city: "Tokio",
            location: "Asakusa, Tokio",
            scheduledAt: new Date("2026-06-08T09:00:00"),
            duration: 120,
            status: "CONFIRMED",
            notes: "Ir temprano para evitar multitudes. Metro: Asakusa (línea Ginza).",
          },
          {
            name: "Teamlab Borderless",
            type: "SHOW",
            city: "Tokio",
            location: "Odaiba, Tokio",
            scheduledAt: new Date("2026-06-09T15:00:00"),
            duration: 180,
            bookingRef: "TLB-20260609",
            price: 3200,
            status: "CONFIRMED",
            notes: "Entradas compradas online. Llevar ropa oscura.",
          },
          {
            name: "Sushi Saito (Omakase)",
            type: "RESTAURANT",
            city: "Tokio",
            location: "Minato, Tokio",
            scheduledAt: new Date("2026-06-10T19:30:00"),
            duration: 90,
            bookingRef: "SS-0610",
            price: 30000,
            status: "RESERVED",
            description: "Uno de los 3 mejores sushis del mundo. Reserva hecha 4 meses antes.",
          },
          {
            name: "Camino del Filósofo + Fushimi Inari",
            type: "ACTIVITY",
            city: "Kioto",
            scheduledAt: new Date("2026-06-13T07:00:00"),
            duration: 300,
            status: "PENDING",
            notes: "Salir muy temprano a Fushimi Inari antes de las 8am. Sin reserva.",
          },
          {
            name: "Experiencia de té en Urasenke",
            type: "TOUR",
            city: "Kioto",
            scheduledAt: new Date("2026-06-14T14:00:00"),
            duration: 90,
            price: 4500,
            bookingRef: "TEA-0614",
            status: "CONFIRMED",
          },
          {
            name: "Nishiki Market + Dotonbori",
            type: "ACTIVITY",
            city: "Osaka",
            scheduledAt: new Date("2026-06-18T11:00:00"),
            duration: 240,
            status: "PENDING",
            description: "Mercado Nishiki por la mañana, Dotonbori por la tarde-noche.",
          },
          {
            name: "Universal Studios Japan",
            type: "ACTIVITY",
            city: "Osaka",
            scheduledAt: new Date("2026-06-19T09:00:00"),
            duration: 480,
            price: 9800,
            bookingRef: "USJ-20260619",
            status: "CONFIRMED",
            notes: "Entradas express compradas. Nintendo World obligatorio.",
          },
        ],
      },
      expenses: {
        create: [
          { category: "FLIGHT", description: "Vuelos ida y vuelta MAD-NRT-OSA-MAD", amount: 1600, currency: "EUR", date: new Date("2026-02-10"), paid: true },
          { category: "ACCOMMODATION", description: "Shinjuku Granbell Hotel (5 noches)", amount: 60000, currency: "JPY", date: new Date("2026-02-15"), paid: true },
          { category: "ACCOMMODATION", description: "Kyoto Machiya Guesthouse (5 noches)", amount: 47500, currency: "JPY", date: new Date("2026-02-15"), paid: true },
          { category: "ACCOMMODATION", description: "Cross Hotel Osaka (4 noches)", amount: 32000, currency: "JPY", date: new Date("2026-02-20"), paid: true },
          { category: "TRANSPORT", description: "Japan Rail Pass 14 días", amount: 70000, currency: "JPY", date: new Date("2026-03-01"), paid: true },
          { category: "ACTIVITY", description: "Teamlab Borderless (2 entradas)", amount: 6400, currency: "JPY", date: new Date("2026-03-15"), paid: true },
          { category: "ACTIVITY", description: "Universal Studios Japan", amount: 19600, currency: "JPY", date: new Date("2026-04-01"), paid: true },
          { category: "FOOD", description: "Presupuesto comida estimado", amount: 50000, currency: "JPY", date: new Date("2026-06-07"), paid: false },
          { category: "SHOPPING", description: "Presupuesto compras estimado", amount: 30000, currency: "JPY", date: new Date("2026-06-07"), paid: false },
        ],
      },
      documents: {
        create: [
          { type: "PASSPORT", name: "Pasaporte español", expiresAt: new Date("2029-08-14"), notes: "Válido hasta 2029. No necesita visado para Japón." },
          { type: "INSURANCE", name: "Seguro de viaje AXA", expiresAt: new Date("2026-06-22"), notes: "Cobertura médica hasta 1.000.000€. Número de póliza: AXA-2026-887342" },
          { type: "TICKET", name: "Japan Rail Pass (PDF)", fileUrl: "https://drive.google.com/file/jrpass", notes: "Activar en el aeropuerto de Narita." },
          { type: "VOUCHER", name: "Reserva Sushi Saito", notes: "Confirmación por email. Presentar al llegar." },
        ],
      },
      packingItems: {
        create: [
          { category: "Documentos", name: "Pasaporte", packed: true },
          { category: "Documentos", name: "Seguro de viaje (papel)", packed: true },
          { category: "Documentos", name: "Japan Rail Pass", packed: false },
          { category: "Documentos", name: "Confirmaciones de hoteles impresas", packed: false },
          { category: "Electrónica", name: "Cargador universal", packed: true },
          { category: "Electrónica", name: "Adaptador tipo A (Japón)", packed: true },
          { category: "Electrónica", name: "Powerbank 20.000mAh", packed: false },
          { category: "Electrónica", name: "Cámara de fotos", packed: false },
          { category: "Ropa", name: "Ropa cómoda para templos", packed: false, quantity: 3 },
          { category: "Ropa", name: "Zapatos cómodos para caminar", packed: false },
          { category: "Ropa", name: "Chubasquero ligero", packed: false },
          { category: "Aseo", name: "Protector solar SPF50", packed: false },
          { category: "Aseo", name: "Medicamentos básicos", packed: true },
          { category: "Varios", name: "Tarjeta de crédito sin comisiones", packed: true },
          { category: "Varios", name: "Efectivo en yenes (retirar en Japón)", packed: false },
          { category: "Varios", name: "IC Card recargable (metro Tokio)", packed: false },
        ],
      },
    },
  });

  // ─── VIAJE 2: Lisboa (hace 2 meses, completado) ───────────────────────────
  const lisboa = await prisma.trip.create({
    data: {
      userId: DEV_USER_ID,
      name: "Lisboa & Sintra",
      description: "Escapada de fin de semana largo. Pastéis de nata y miradores.",
      startDate: new Date("2026-03-14"),
      endDate: new Date("2026-03-17"),
      status: "COMPLETED",
      currency: "EUR",
      budget: 600,
      destinations: {
        create: [
          { city: "Lisboa", country: "Portugal", arrivalDate: new Date("2026-03-14"), departureDate: new Date("2026-03-16"), order: 1 },
          { city: "Sintra", country: "Portugal", arrivalDate: new Date("2026-03-16"), departureDate: new Date("2026-03-17"), order: 2 },
        ],
      },
      flights: {
        create: [
          {
            airline: "Vueling",
            flightNumber: "VY1814",
            origin: "MAD",
            destination: "LIS",
            departureAt: new Date("2026-03-14T07:00:00"),
            arrivalAt: new Date("2026-03-14T08:20:00"),
            bookingRef: "VUELING-7X4M",
            class: "ECONOMY",
            price: 65,
          },
          {
            airline: "Vueling",
            flightNumber: "VY1817",
            origin: "LIS",
            destination: "MAD",
            departureAt: new Date("2026-03-17T20:10:00"),
            arrivalAt: new Date("2026-03-17T21:35:00"),
            bookingRef: "VUELING-7X4N",
            class: "ECONOMY",
            price: 72,
          },
        ],
      },
      accommodations: {
        create: [
          {
            name: "LX Boutique Hotel",
            type: "HOTEL",
            city: "Lisboa",
            address: "Rua do Alecrim 12, Chiado, Lisboa",
            checkIn: new Date("2026-03-14"),
            checkOut: new Date("2026-03-17"),
            bookingRef: "BKG-LX-11290",
            pricePerNight: 95,
            price: 285,
          },
        ],
      },
      activities: {
        create: [
          { name: "Barrio de Alfama y Castillo de San Jorge", type: "ACTIVITY", city: "Lisboa", scheduledAt: new Date("2026-03-14T15:00:00"), duration: 180, status: "CONFIRMED" },
          { name: "Fado en el restaurante A Tasca do Chico", type: "SHOW", city: "Lisboa", scheduledAt: new Date("2026-03-14T21:30:00"), duration: 150, price: 35, status: "CONFIRMED", bookingRef: "FADO-0314" },
          { name: "Belém: Torre y Pastéis", type: "ACTIVITY", city: "Lisboa", scheduledAt: new Date("2026-03-15T10:00:00"), duration: 240, status: "CONFIRMED" },
          { name: "Palacio da Pena en Sintra", type: "MUSEUM", city: "Sintra", scheduledAt: new Date("2026-03-16T10:00:00"), duration: 300, price: 18, status: "CONFIRMED" },
        ],
      },
      expenses: {
        create: [
          { category: "FLIGHT", description: "Vuelos MAD-LIS-MAD", amount: 137, currency: "EUR", date: new Date("2026-03-14"), paid: true },
          { category: "ACCOMMODATION", description: "LX Boutique Hotel (3 noches)", amount: 285, currency: "EUR", date: new Date("2026-03-14"), paid: true },
          { category: "FOOD", description: "Restaurantes y cafés", amount: 98, currency: "EUR", date: new Date("2026-03-17"), paid: true },
          { category: "ACTIVITY", description: "Entradas y espectáculos", amount: 53, currency: "EUR", date: new Date("2026-03-17"), paid: true },
          { category: "TRANSPORT", description: "Metro y taxis", amount: 28, currency: "EUR", date: new Date("2026-03-17"), paid: true },
          { category: "SHOPPING", description: "Souvenirs y regalos", amount: 45, currency: "EUR", date: new Date("2026-03-17"), paid: true },
        ],
      },
      documents: {
        create: [
          { type: "TICKET", name: "Vuelos Vueling (PDF)", notes: "Localizador: VUELING-7X4M / 7X4N" },
        ],
      },
    },
  });

  // ─── VIAJE 3: Marruecos (planificando, dentro de 4 meses) ─────────────────
  const marruecos = await prisma.trip.create({
    data: {
      userId: DEV_USER_ID,
      name: "Marruecos - Desierto y Medinas",
      description: "Marrakech, el desierto del Sáhara y las gargantas del Todra. 10 días de aventura.",
      startDate: new Date("2026-10-03"),
      endDate: new Date("2026-10-12"),
      status: "PLANNING",
      currency: "EUR",
      budget: 1200,
      destinations: {
        create: [
          { city: "Marrakech", country: "Marruecos", arrivalDate: new Date("2026-10-03"), departureDate: new Date("2026-10-05"), order: 1 },
          { city: "Merzouga", country: "Marruecos", arrivalDate: new Date("2026-10-06"), departureDate: new Date("2026-10-08"), order: 2 },
          { city: "Fez", country: "Marruecos", arrivalDate: new Date("2026-10-09"), departureDate: new Date("2026-10-12"), order: 3 },
        ],
      },
      flights: {
        create: [
          {
            airline: "Ryanair",
            flightNumber: "FR6610",
            origin: "MAD",
            destination: "RAK",
            departureAt: new Date("2026-10-03T06:25:00"),
            arrivalAt: new Date("2026-10-03T07:55:00"),
            bookingRef: "RYN-MAR26",
            class: "ECONOMY",
            price: 45,
          },
          {
            airline: "Royal Air Maroc",
            flightNumber: "AT564",
            origin: "FEZ",
            destination: "MAD",
            departureAt: new Date("2026-10-12T15:30:00"),
            arrivalAt: new Date("2026-10-12T18:45:00"),
            bookingRef: "RAM-FEZ26",
            class: "ECONOMY",
            price: 89,
          },
        ],
      },
      accommodations: {
        create: [
          {
            name: "Riad Yasmine",
            type: "HOTEL",
            city: "Marrakech",
            address: "Derb Sidi Ahmed Ou Moussa, Medina, Marrakech",
            checkIn: new Date("2026-10-03"),
            checkOut: new Date("2026-10-05"),
            pricePerNight: 55,
            price: 110,
            notes: "Riad tradicional en la medina. Sin coche de acceso directo.",
          },
          {
            name: "Campamento en el desierto - Sahara Experience",
            type: "OTHER",
            city: "Merzouga",
            checkIn: new Date("2026-10-06"),
            checkOut: new Date("2026-10-08"),
            pricePerNight: 80,
            price: 160,
            notes: "Incluye cena, desayuno y paseo en camello al amanecer.",
          },
          {
            name: "Riad Laaroussa",
            type: "HOTEL",
            city: "Fez",
            address: "3 Derb Bechara, Médina de Fés",
            checkIn: new Date("2026-10-09"),
            checkOut: new Date("2026-10-12"),
            pricePerNight: 65,
            price: 195,
          },
        ],
      },
      activities: {
        create: [
          { name: "Visita guiada a la medina de Marrakech", type: "TOUR", city: "Marrakech", scheduledAt: new Date("2026-10-04T09:00:00"), duration: 300, price: 25, status: "PENDING" },
          { name: "Hammam tradicional", type: "ACTIVITY", city: "Marrakech", scheduledAt: new Date("2026-10-04T17:00:00"), duration: 90, price: 20, status: "PENDING" },
          { name: "Noche en el desierto + camello", type: "ACTIVITY", city: "Merzouga", scheduledAt: new Date("2026-10-07T17:00:00"), duration: 720, status: "PENDING", notes: "Incluido en el campamento." },
          { name: "Curtidurías de Fez (Chouara Tannery)", type: "ACTIVITY", city: "Fez", scheduledAt: new Date("2026-10-10T10:00:00"), duration: 120, status: "PENDING" },
          { name: "Tour gastronómico por la medina de Fez", type: "TOUR", city: "Fez", scheduledAt: new Date("2026-10-11T11:00:00"), duration: 180, price: 35, status: "PENDING" },
        ],
      },
      expenses: {
        create: [
          { category: "FLIGHT", description: "Vuelos MAD-RAK + FEZ-MAD", amount: 134, currency: "EUR", date: new Date("2026-10-03"), paid: false },
          { category: "ACCOMMODATION", description: "Riad Yasmine Marrakech", amount: 110, currency: "EUR", date: new Date("2026-10-03"), paid: false },
          { category: "ACCOMMODATION", description: "Campamento desierto Merzouga", amount: 160, currency: "EUR", date: new Date("2026-10-06"), paid: false },
          { category: "ACCOMMODATION", description: "Riad Laaroussa Fez", amount: 195, currency: "EUR", date: new Date("2026-10-09"), paid: false },
        ],
      },
      documents: {
        create: [
          { type: "PASSPORT", name: "Pasaporte español", notes: "No necesita visado. Válido hasta 2029." },
          { type: "INSURANCE", name: "Seguro de viaje (pendiente contratar)", notes: "Contratar antes de agosto." },
        ],
      },
      packingItems: {
        create: [
          { category: "Documentos", name: "Pasaporte", packed: false },
          { category: "Ropa", name: "Ropa ligera pero tapada (normas culturales)", packed: false, quantity: 4 },
          { category: "Ropa", name: "Ropa de abrigo para el desierto por la noche", packed: false },
          { category: "Aseo", name: "Protector solar SPF50", packed: false },
          { category: "Aseo", name: "Repelente de mosquitos", packed: false },
          { category: "Varios", name: "Efectivo en dirhams", packed: false },
          { category: "Varios", name: "Pañuelo grande (para la arena)", packed: false },
        ],
      },
    },
  });

  console.log(`✅ Seed completado:`);
  console.log(`   • ${japon.name} (${japon.status})`);
  console.log(`   • ${lisboa.name} (${lisboa.status})`);
  console.log(`   • ${marruecos.name} (${marruecos.status})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
