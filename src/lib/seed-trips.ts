import type { PrismaClient } from "@prisma/client";

export async function seedTripsForUser(prisma: PrismaClient, userId: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Returns a Date offset by `days` from today, optionally with a specific time.
  const at = (days: number, hour = 0, minute = 0): Date => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  await prisma.trip.deleteMany({ where: { userId } });

  // ─── VIAJE 1: Japón (reservado, empieza en ~2 semanas) ────────────────────
  await prisma.trip.create({
    data: {
      userId,
      name: "Japón - Cerezos en flor",
      description: "Tokio, Kioto y Osaka coincidiendo con el hanami. Sueño cumplido.",
      startDate: at(15),
      endDate: at(29),
      status: "BOOKED",
      currency: "JPY",
      budget: 350000,
      destinations: {
        create: [
          { city: "Tokio", country: "Japón", arrivalDate: at(15), departureDate: at(20), order: 1 },
          { city: "Kioto", country: "Japón", arrivalDate: at(20), departureDate: at(25), order: 2 },
          { city: "Osaka", country: "Japón", arrivalDate: at(25), departureDate: at(29), order: 3 },
        ],
      },
      flights: {
        create: [
          {
            airline: "Iberia",
            flightNumber: "IB6841",
            origin: "MAD",
            destination: "NRT",
            departureAt: at(15, 10, 30),
            arrivalAt: at(16, 7, 15),
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
            departureAt: at(29, 14, 0),
            arrivalAt: at(30, 19, 45),
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
            departureAt: at(20, 9, 0),
            arrivalAt: at(20, 11, 17),
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
            checkIn: at(15),
            checkOut: at(20),
            bookingRef: "BKG-38821",
            pricePerNight: 12000,
            price: 60000,
            notes: "Check-in desde las 15:00. Desayuno incluido.",
          },
          {
            name: "Kyoto Machiya Guesthouse",
            type: "AIRBNB",
            city: "Kioto",
            address: "Nakagyo-ku, Kyoto",
            checkIn: at(20),
            checkOut: at(25),
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
            checkIn: at(25),
            checkOut: at(29),
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
            scheduledAt: at(16, 9, 0),
            duration: 120,
            status: "CONFIRMED",
            notes: "Ir temprano para evitar multitudes. Metro: Asakusa (línea Ginza).",
          },
          {
            name: "Teamlab Borderless",
            type: "SHOW",
            city: "Tokio",
            location: "Odaiba, Tokio",
            scheduledAt: at(17, 15, 0),
            duration: 180,
            bookingRef: "TLB-DEMO",
            price: 3200,
            status: "CONFIRMED",
            notes: "Entradas compradas online. Llevar ropa oscura.",
          },
          {
            name: "Sushi Saito (Omakase)",
            type: "RESTAURANT",
            city: "Tokio",
            location: "Minato, Tokio",
            scheduledAt: at(18, 19, 30),
            duration: 90,
            bookingRef: "SS-DEMO",
            price: 30000,
            status: "RESERVED",
            description: "Uno de los 3 mejores sushis del mundo. Reserva hecha 4 meses antes.",
          },
          {
            name: "Camino del Filósofo + Fushimi Inari",
            type: "ACTIVITY",
            city: "Kioto",
            scheduledAt: at(21, 7, 0),
            duration: 300,
            status: "PENDING",
            notes: "Salir muy temprano a Fushimi Inari antes de las 8am. Sin reserva.",
          },
          {
            name: "Experiencia de té en Urasenke",
            type: "TOUR",
            city: "Kioto",
            scheduledAt: at(22, 14, 0),
            duration: 90,
            price: 4500,
            bookingRef: "TEA-DEMO",
            status: "CONFIRMED",
          },
          {
            name: "Nishiki Market + Dotonbori",
            type: "ACTIVITY",
            city: "Osaka",
            scheduledAt: at(26, 11, 0),
            duration: 240,
            status: "PENDING",
            description: "Mercado Nishiki por la mañana, Dotonbori por la tarde-noche.",
          },
          {
            name: "Universal Studios Japan",
            type: "ACTIVITY",
            city: "Osaka",
            scheduledAt: at(27, 9, 0),
            duration: 480,
            price: 9800,
            bookingRef: "USJ-DEMO",
            status: "CONFIRMED",
            notes: "Entradas express compradas. Nintendo World obligatorio.",
          },
        ],
      },
      expenses: {
        create: [
          { category: "FLIGHT", description: "Vuelos ida y vuelta MAD-NRT-OSA-MAD", amount: 1600, currency: "EUR", date: at(-103), paid: true },
          { category: "ACCOMMODATION", description: "Shinjuku Granbell Hotel (5 noches)", amount: 60000, currency: "JPY", date: at(-98), paid: true },
          { category: "ACCOMMODATION", description: "Kyoto Machiya Guesthouse (5 noches)", amount: 47500, currency: "JPY", date: at(-98), paid: true },
          { category: "ACCOMMODATION", description: "Cross Hotel Osaka (4 noches)", amount: 32000, currency: "JPY", date: at(-93), paid: true },
          { category: "TRANSPORT", description: "Japan Rail Pass 14 días", amount: 70000, currency: "JPY", date: at(-83), paid: true },
          { category: "ACTIVITY", description: "Teamlab Borderless (2 entradas)", amount: 6400, currency: "JPY", date: at(-69), paid: true },
          { category: "ACTIVITY", description: "Universal Studios Japan", amount: 19600, currency: "JPY", date: at(-52), paid: true },
          { category: "FOOD", description: "Presupuesto comida estimado", amount: 50000, currency: "JPY", date: at(15), paid: false },
          { category: "SHOPPING", description: "Presupuesto compras estimado", amount: 30000, currency: "JPY", date: at(15), paid: false },
        ],
      },
      documents: {
        create: [
          { type: "PASSPORT", name: "Pasaporte español", expiresAt: at(1181), notes: "Válido hasta 2029. No necesita visado para Japón." },
          { type: "INSURANCE", name: "Seguro de viaje AXA", expiresAt: at(31), notes: "Cobertura médica hasta 1.000.000€. Número de póliza: AXA-DEMO" },
          { type: "TICKET", name: "Japan Rail Pass (PDF)", notes: "Activar en el aeropuerto de Narita." },
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

  // ─── VIAJE 2: Lisboa (completado, hace ~2 meses) ──────────────────────────
  await prisma.trip.create({
    data: {
      userId,
      name: "Lisboa & Sintra",
      description: "Escapada de fin de semana largo. Pastéis de nata y miradores.",
      startDate: at(-70),
      endDate: at(-67),
      status: "COMPLETED",
      currency: "EUR",
      budget: 600,
      destinations: {
        create: [
          { city: "Lisboa", country: "Portugal", arrivalDate: at(-70), departureDate: at(-68), order: 1 },
          { city: "Sintra", country: "Portugal", arrivalDate: at(-68), departureDate: at(-67), order: 2 },
        ],
      },
      flights: {
        create: [
          {
            airline: "Vueling",
            flightNumber: "VY1814",
            origin: "MAD",
            destination: "LIS",
            departureAt: at(-70, 7, 0),
            arrivalAt: at(-70, 8, 20),
            bookingRef: "VUELING-DEMO1",
            class: "ECONOMY",
            price: 65,
          },
          {
            airline: "Vueling",
            flightNumber: "VY1817",
            origin: "LIS",
            destination: "MAD",
            departureAt: at(-67, 20, 10),
            arrivalAt: at(-67, 21, 35),
            bookingRef: "VUELING-DEMO2",
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
            checkIn: at(-70),
            checkOut: at(-67),
            bookingRef: "BKG-LX-DEMO",
            pricePerNight: 95,
            price: 285,
          },
        ],
      },
      activities: {
        create: [
          { name: "Barrio de Alfama y Castillo de San Jorge", type: "ACTIVITY", city: "Lisboa", scheduledAt: at(-70, 15, 0), duration: 180, status: "CONFIRMED" },
          { name: "Fado en el restaurante A Tasca do Chico", type: "SHOW", city: "Lisboa", scheduledAt: at(-70, 21, 30), duration: 150, price: 35, status: "CONFIRMED", bookingRef: "FADO-DEMO" },
          { name: "Belém: Torre y Pastéis", type: "ACTIVITY", city: "Lisboa", scheduledAt: at(-69, 10, 0), duration: 240, status: "CONFIRMED" },
          { name: "Palacio da Pena en Sintra", type: "MUSEUM", city: "Sintra", scheduledAt: at(-68, 10, 0), duration: 300, price: 18, status: "CONFIRMED" },
        ],
      },
      expenses: {
        create: [
          { category: "FLIGHT", description: "Vuelos MAD-LIS-MAD", amount: 137, currency: "EUR", date: at(-70), paid: true },
          { category: "ACCOMMODATION", description: "LX Boutique Hotel (3 noches)", amount: 285, currency: "EUR", date: at(-70), paid: true },
          { category: "FOOD", description: "Restaurantes y cafés", amount: 98, currency: "EUR", date: at(-67), paid: true },
          { category: "ACTIVITY", description: "Entradas y espectáculos", amount: 53, currency: "EUR", date: at(-67), paid: true },
          { category: "TRANSPORT", description: "Metro y taxis", amount: 28, currency: "EUR", date: at(-67), paid: true },
          { category: "SHOPPING", description: "Souvenirs y regalos", amount: 45, currency: "EUR", date: at(-67), paid: true },
        ],
      },
      documents: {
        create: [
          { type: "TICKET", name: "Vuelos Vueling (PDF)", notes: "Localizador: VUELING-DEMO1 / DEMO2" },
        ],
      },
    },
  });

  // ─── VIAJE 3: Marruecos (planificando, dentro de ~4 meses) ───────────────
  await prisma.trip.create({
    data: {
      userId,
      name: "Marruecos - Desierto y Medinas",
      description: "Marrakech, el desierto del Sáhara y las gargantas del Todra. 10 días de aventura.",
      startDate: at(133),
      endDate: at(142),
      status: "PLANNING",
      currency: "EUR",
      budget: 1200,
      destinations: {
        create: [
          { city: "Marrakech", country: "Marruecos", arrivalDate: at(133), departureDate: at(135), order: 1 },
          { city: "Merzouga", country: "Marruecos", arrivalDate: at(136), departureDate: at(138), order: 2 },
          { city: "Fez", country: "Marruecos", arrivalDate: at(139), departureDate: at(142), order: 3 },
        ],
      },
      flights: {
        create: [
          {
            airline: "Ryanair",
            flightNumber: "FR6610",
            origin: "MAD",
            destination: "RAK",
            departureAt: at(133, 6, 25),
            arrivalAt: at(133, 7, 55),
            bookingRef: "RYN-DEMO",
            class: "ECONOMY",
            price: 45,
          },
          {
            airline: "Royal Air Maroc",
            flightNumber: "AT564",
            origin: "FEZ",
            destination: "MAD",
            departureAt: at(142, 15, 30),
            arrivalAt: at(142, 18, 45),
            bookingRef: "RAM-DEMO",
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
            checkIn: at(133),
            checkOut: at(135),
            pricePerNight: 55,
            price: 110,
            notes: "Riad tradicional en la medina. Sin coche de acceso directo.",
          },
          {
            name: "Campamento en el desierto - Sahara Experience",
            type: "OTHER",
            city: "Merzouga",
            checkIn: at(136),
            checkOut: at(138),
            pricePerNight: 80,
            price: 160,
            notes: "Incluye cena, desayuno y paseo en camello al amanecer.",
          },
          {
            name: "Riad Laaroussa",
            type: "HOTEL",
            city: "Fez",
            address: "3 Derb Bechara, Médina de Fés",
            checkIn: at(139),
            checkOut: at(142),
            pricePerNight: 65,
            price: 195,
          },
        ],
      },
      activities: {
        create: [
          { name: "Visita guiada a la medina de Marrakech", type: "TOUR", city: "Marrakech", scheduledAt: at(134, 9, 0), duration: 300, price: 25, status: "PENDING" },
          { name: "Hammam tradicional", type: "ACTIVITY", city: "Marrakech", scheduledAt: at(134, 17, 0), duration: 90, price: 20, status: "PENDING" },
          { name: "Noche en el desierto + camello", type: "ACTIVITY", city: "Merzouga", scheduledAt: at(137, 17, 0), duration: 720, status: "PENDING", notes: "Incluido en el campamento." },
          { name: "Curtidurías de Fez (Chouara Tannery)", type: "ACTIVITY", city: "Fez", scheduledAt: at(140, 10, 0), duration: 120, status: "PENDING" },
          { name: "Tour gastronómico por la medina de Fez", type: "TOUR", city: "Fez", scheduledAt: at(141, 11, 0), duration: 180, price: 35, status: "PENDING" },
        ],
      },
      expenses: {
        create: [
          { category: "FLIGHT", description: "Vuelos MAD-RAK + FEZ-MAD", amount: 134, currency: "EUR", date: at(133), paid: false },
          { category: "ACCOMMODATION", description: "Riad Yasmine Marrakech", amount: 110, currency: "EUR", date: at(133), paid: false },
          { category: "ACCOMMODATION", description: "Campamento desierto Merzouga", amount: 160, currency: "EUR", date: at(136), paid: false },
          { category: "ACCOMMODATION", description: "Riad Laaroussa Fez", amount: 195, currency: "EUR", date: at(139), paid: false },
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
}
