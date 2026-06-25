export const es = {
  locale: "es" as "es" | "en",
  dateLocale: "es-ES",

  // --- Nav ---
  navHome: "Inicio",
  navTrips: "Mis viajes",
  navProfile: "Perfil",
  navAdmin: "Panel de administración",
  navSignOut: "Cerrar sesión",

  // --- Dashboard ---
  dashboardTitle: "Bienvenido/a",
  dashboardSubtitle: "Tus próximos viajes y actividad reciente",
  noTripsYet: "Aún no tienes viajes",
  noTripsYetHint: "Crea tu primer viaje para empezar a planificar",
  createFirstTrip: "Crear primer viaje",
  upcomingTrips: "Próximos viajes",
  recentActivity: "Actividad reciente",
  viewAll: "Ver todos",

  // --- Trips ---
  trips: "Viajes",
  myTrips: "Mis viajes",
  newTrip: "Nuevo viaje",
  editTrip: "Editar viaje",
  deleteTrip: "Eliminar viaje",
  confirmDeleteTrip: "¿Eliminar este viaje? Esta acción no se puede deshacer.",
  tripName: "Nombre",
  tripDescription: "Descripción",
  tripDescriptionPlaceholder: "Notas sobre el viaje (opcional)",
  startDate: "Fecha de inicio",
  endDate: "Fecha de fin",
  tripCurrency: "Moneda",
  tripBudget: "Presupuesto",
  createTrip: "Crear viaje",
  updateTrip: "Guardar cambios",
  tripNameRequired: "El nombre del viaje es obligatorio",
  days: "días",
  day: "día",

  // --- Trip status ---
  statusUpcoming: "Próximo",
  statusOngoing: "En curso",
  statusPast: "Pasado",

  // --- Trip detail (timeline) ---
  tripTimeline: "Cronología del viaje",
  tripProgress: "progreso del viaje",
  dayN: (n: number) => `Día ${n}`,
  dayOf: (e: number, t: number) => `Día ${e} de ${t}`,
  tripCompleted: "Viaje completado",
  today: "Hoy",
  flightDeparture: "Salida",
  flightArrival: "Llegada",
  checkIn: "Check-in",
  checkOut: "Check-out",
  undatedActivities: "Sin fecha asignada",
  quickStatus: "Estado rápido",
  budget: "Presupuesto",
  packing: "Equipaje",
  confirmedActivities: "Actividades confirmadas",

  // --- Stats ---
  statsSpent: "Gastado",
  statsExpenses: "Gastos",
  statsFlights: "Vuelos",
  statsActivities: "Actividades",
  daysUntil: (n: number) => `Faltan ${n} días`,
  daysAgo: (n: number) => `Hace ${n} días`,
  inProgress: "En curso",

  // --- Sections ---
  flights: "Vuelos",
  accommodations: "Alojamiento",
  activities: "Actividades",
  expenses: "Gastos",
  packingList: "Equipaje",
  documents: "Documentos",
  tasks: "Tareas",

  // --- Flights ---
  noFlights: "Sin vuelos",
  noFlightsHint: "Añade vuelos de tu itinerario",
  addFlight: "Añadir vuelo",
  editFlight: "Editar vuelo",
  flightOrigin: "Origen",
  flightDestination: "Destino",
  flightAirline: "Aerolínea",
  flightNumber: "Número de vuelo",
  flightDepartureDate: "Fecha de salida",
  flightArrivalDate: "Fecha de llegada",
  bookingRef: "Referencia de reserva",
  seatNumber: "Asiento",
  flightClass: "Clase",
  confirmed: "Confirmado",
  unconfirmed: "Sin confirmar",

  // --- Accommodations ---
  noAccommodations: "Sin alojamientos",
  noAccommodationsHint: "Añade los hoteles y apartamentos de tu viaje",
  addAccommodation: "Añadir alojamiento",
  editAccommodation: "Editar alojamiento",
  checkInDate: "Check-in",
  checkOutDate: "Check-out",
  city: "Ciudad",
  address: "Dirección",
  pricePerNight: "Precio/noche",

  // --- Activities ---
  noActivities: "Sin actividades",
  noActivitiesHint: "Añade los planes y actividades de tu viaje",
  addActivity: "Añadir actividad",
  editActivity: "Editar actividad",
  scheduledAt: "Fecha y hora",
  location: "Ubicación",
  duration: "Duración (min)",
  activityStatus: "Estado",
  statusPending: "Pendiente",
  statusReserved: "Reservado",
  statusConfirmed: "Confirmado",
  statusCancelled: "Cancelado",

  // --- Expenses ---
  noExpenses: "Sin gastos",
  noExpensesHint: "Registra los gastos de tu viaje",
  addExpense: "Añadir gasto",
  editExpense: "Editar gasto",
  amount: "Importe",
  expenseDate: "Fecha",
  category: "Categoría",
  paid: "Pagado",
  pending: "Pendiente",
  totalExpenses: "Total gastos",
  ofBudget: (pct: number) => `${pct}% del presupuesto`,

  // --- Packing ---
  noPackingItems: "Lista de equipaje vacía",
  noPackingItemsHint: "Añade los ítems que necesitas llevar",
  addPackingItem: "Añadir ítem",
  editPackingItem: "Editar ítem",
  packed: "Empacado",
  quantity: "Cantidad",
  packingCategory: "Categoría",
  allPacked: "¡Todo listo!",

  // --- Documents ---
  noDocuments: "Sin documentos",
  noDocumentsHint: "Añade tus documentos de viaje: pasaporte, visado, seguro...",
  addDocument: "Añadir documento",
  editDocument: "Editar documento",
  expiresAt: "Caduca",
  expired: "Caducado",
  expiresSoon: "Caduca pronto",

  // --- Tasks ---
  noTasks: "Sin tareas",
  noTasksHint: "Añade tareas pendientes para tu viaje",
  addTask: "Añadir tarea",
  editTask: "Editar tarea",
  taskTitle: "Título",
  taskNotes: "Notas",
  taskDueDate: "Fecha límite",
  taskPriority: "Prioridad",
  priorityLow: "Baja",
  priorityMedium: "Media",
  priorityHigh: "Alta",
  overdue: "Vencida",
  taskDone: "Completada",
  taskPending: "Pendiente",

  // --- Import ---
  importAI: "Importar vía IA",
  importStep1Title: "Generar prompt",
  importStep2Title: "Pegar JSON",
  importStep3Title: "Revisar e importar",
  importSuccess: (n: number) => `${n} elemento${n === 1 ? "" : "s"} importado${n === 1 ? "" : "s"}`,
  duplicate: "Posible duplicado",

  // --- Forms ---
  save: "Guardar",
  cancel: "Cancelar",
  delete: "Eliminar",
  edit: "Editar",
  close: "Cerrar",
  confirm: "Confirmar",
  add: "Añadir",
  noDate: "Sin fecha",
  notes: "Notas",
  price: "Precio",
  optional: "Opcional",
  required: "Obligatorio",

  // --- Auth ---
  signIn: "Iniciar sesión",
  signOut: "Cerrar sesión",
  email: "Correo electrónico",
  password: "Contraseña",
  signingIn: "Iniciando sesión…",
  invalidCredentials: "Correo o contraseña incorrectos",

  // --- Profile ---
  profile: "Perfil",
  displayName: "Nombre para mostrar",
  saveProfile: "Guardar perfil",

  // --- Language ---
  language: "Idioma",
  langEs: "Español",
  langEn: "English",

  // --- Section nav chips ---
  sectionFlights: "Vuelos",
  sectionAccommodations: "Alojamiento",
  sectionActivities: "Actividades",
  sectionTasks: "Tareas",
  sectionDocuments: "Documentos",
  sectionExpenses: "Gastos",
  sectionPacking: "Equipaje",
  moreSections: "Más",

  // --- Misc ---
  loading: "Cargando…",
  error: "Ha ocurrido un error",
  notFound: "No encontrado",
  backToTrips: "Volver a mis viajes",
  editBtn: "Editar",
  deleteBtn: "Eliminar",
};

export type WebTKeys = typeof es;
