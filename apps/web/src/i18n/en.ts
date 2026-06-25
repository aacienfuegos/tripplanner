import type { WebTKeys } from "./es";

export const en: WebTKeys = {
  locale: "en" as const,
  dateLocale: "en-US",

  // --- Nav ---
  navHome: "Home",
  navTrips: "My trips",
  navProfile: "Profile",
  navAdmin: "Admin panel",
  navSignOut: "Sign out",

  // --- Dashboard ---
  dashboardTitle: "Welcome",
  dashboardSubtitle: "Your upcoming trips and recent activity",
  noTripsYet: "No trips yet",
  noTripsYetHint: "Create your first trip to start planning",
  createFirstTrip: "Create first trip",
  upcomingTrips: "Upcoming trips",
  recentActivity: "Recent activity",
  viewAll: "View all",

  // --- Trips ---
  trips: "Trips",
  myTrips: "My trips",
  newTrip: "New trip",
  editTrip: "Edit trip",
  deleteTrip: "Delete trip",
  confirmDeleteTrip: "Delete this trip? This action cannot be undone.",
  tripName: "Name",
  tripDescription: "Description",
  tripDescriptionPlaceholder: "Notes about the trip (optional)",
  startDate: "Start date",
  endDate: "End date",
  tripCurrency: "Currency",
  tripBudget: "Budget",
  createTrip: "Create trip",
  updateTrip: "Save changes",
  tripNameRequired: "Trip name is required",
  days: "days",
  day: "day",

  // --- Trip status ---
  statusUpcoming: "Upcoming",
  statusOngoing: "Ongoing",
  statusPast: "Past",

  // --- Trip detail (timeline) ---
  tripTimeline: "Trip timeline",
  tripProgress: "trip progress",
  dayN: (n: number) => `Day ${n}`,
  dayOf: (e: number, t: number) => `Day ${e} of ${t}`,
  tripCompleted: "Trip completed",
  today: "Today",
  flightDeparture: "Departure",
  flightArrival: "Arrival",
  checkIn: "Check-in",
  checkOut: "Check-out",
  undatedActivities: "No date assigned",
  quickStatus: "Quick status",
  budget: "Budget",
  packing: "Packing",
  confirmedActivities: "Confirmed activities",

  // --- Stats ---
  statsSpent: "Spent",
  statsExpenses: "Expenses",
  statsFlights: "Flights",
  statsActivities: "Activities",
  daysUntil: (n: number) => `${n} days to go`,
  daysAgo: (n: number) => `${n} days ago`,
  inProgress: "In progress",

  // --- Sections ---
  flights: "Flights",
  accommodations: "Accommodation",
  activities: "Activities",
  expenses: "Expenses",
  packingList: "Packing list",
  documents: "Documents",
  tasks: "Tasks",

  // --- Flights ---
  noFlights: "No flights",
  noFlightsHint: "Add flights from your itinerary",
  addFlight: "Add flight",
  editFlight: "Edit flight",
  flightOrigin: "Origin",
  flightDestination: "Destination",
  flightAirline: "Airline",
  flightNumber: "Flight number",
  flightDepartureDate: "Departure date",
  flightArrivalDate: "Arrival date",
  bookingRef: "Booking reference",
  seatNumber: "Seat",
  flightClass: "Class",
  confirmed: "Confirmed",
  unconfirmed: "Unconfirmed",

  // --- Accommodations ---
  noAccommodations: "No accommodations",
  noAccommodationsHint: "Add the hotels and apartments for your trip",
  addAccommodation: "Add accommodation",
  editAccommodation: "Edit accommodation",
  checkInDate: "Check-in",
  checkOutDate: "Check-out",
  city: "City",
  address: "Address",
  pricePerNight: "Price/night",

  // --- Activities ---
  noActivities: "No activities",
  noActivitiesHint: "Add plans and activities for your trip",
  addActivity: "Add activity",
  editActivity: "Edit activity",
  scheduledAt: "Date & time",
  location: "Location",
  duration: "Duration (min)",
  activityStatus: "Status",
  statusPending: "Pending",
  statusReserved: "Reserved",
  statusConfirmed: "Confirmed",
  statusCancelled: "Cancelled",

  // --- Expenses ---
  noExpenses: "No expenses",
  noExpensesHint: "Track your trip expenses",
  addExpense: "Add expense",
  editExpense: "Edit expense",
  amount: "Amount",
  expenseDate: "Date",
  category: "Category",
  paid: "Paid",
  pending: "Pending",
  totalExpenses: "Total expenses",
  ofBudget: (pct: number) => `${pct}% of budget`,

  // --- Packing ---
  noPackingItems: "Packing list is empty",
  noPackingItemsHint: "Add items you need to bring",
  addPackingItem: "Add item",
  editPackingItem: "Edit item",
  packed: "Packed",
  quantity: "Quantity",
  packingCategory: "Category",
  allPacked: "All packed!",

  // --- Documents ---
  noDocuments: "No documents",
  noDocumentsHint: "Add your travel documents: passport, visa, insurance...",
  addDocument: "Add document",
  editDocument: "Edit document",
  expiresAt: "Expires",
  expired: "Expired",
  expiresSoon: "Expires soon",

  // --- Tasks ---
  noTasks: "No tasks",
  noTasksHint: "Add pending tasks for your trip",
  addTask: "Add task",
  editTask: "Edit task",
  taskTitle: "Title",
  taskNotes: "Notes",
  taskDueDate: "Due date",
  taskPriority: "Priority",
  priorityLow: "Low",
  priorityMedium: "Medium",
  priorityHigh: "High",
  overdue: "Overdue",
  taskDone: "Done",
  taskPending: "Pending",

  // --- Import ---
  importAI: "Import via AI",
  importStep1Title: "Generate prompt",
  importStep2Title: "Paste JSON",
  importStep3Title: "Review & import",
  importSuccess: (n: number) => `${n} item${n === 1 ? "" : "s"} imported`,
  duplicate: "Possible duplicate",

  // --- Forms ---
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  close: "Close",
  confirm: "Confirm",
  add: "Add",
  noDate: "No date",
  notes: "Notes",
  price: "Price",
  optional: "Optional",
  required: "Required",

  // --- Auth ---
  signIn: "Sign in",
  signOut: "Sign out",
  email: "Email",
  password: "Password",
  signingIn: "Signing in…",
  invalidCredentials: "Invalid email or password",

  // --- Profile ---
  profile: "Profile",
  displayName: "Display name",
  saveProfile: "Save profile",

  // --- Language ---
  language: "Language",
  langEs: "Español",
  langEn: "English",

  // --- Section nav chips ---
  sectionFlights: "Flights",
  sectionAccommodations: "Accommodation",
  sectionActivities: "Activities",
  sectionTasks: "Tasks",
  sectionDocuments: "Documents",
  sectionExpenses: "Expenses",
  sectionPacking: "Packing",

  // --- Misc ---
  loading: "Loading…",
  error: "An error occurred",
  notFound: "Not found",
  backToTrips: "Back to my trips",
  editBtn: "Edit",
  deleteBtn: "Delete",
};
