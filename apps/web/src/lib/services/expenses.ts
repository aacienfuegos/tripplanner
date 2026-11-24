import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getExchangeRate } from "@/lib/exchangeRate";
import { expenseInputSchema, type ExpenseInput } from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { requireTrip } from "@/lib/services/access";
import { NotFoundError, orNotFound, parseInput } from "@/lib/services/errors";
import { toDate } from "@/lib/services/dates";
import { auditedCreate, auditedUpdate, markOf } from "@/lib/services/audit";

// What the database puts when an expense comes without a currency.
const DEFAULT_CURRENCY = "EUR";

async function resolveConversion(expenseCurrency: string, tripCurrency: string, amount: number) {
  if (expenseCurrency === tripCurrency) return { exchangeRate: null, convertedAmount: null };
  const rate = await getExchangeRate(expenseCurrency, tripCurrency);
  if (rate === null) return { exchangeRate: null, convertedAmount: null };
  return { exchangeRate: rate, convertedAmount: amount * rate };
}

// Los gastos guardan exchangeRate/convertedAmount calculados contra la moneda
// del viaje en el momento de crearse/editarse — si luego cambia trip.currency
// (updateTrip), esos valores quedan obsoletos y hay que recalcularlos todos,
// incluyendo los que antes tenían convertedAmount: null por coincidir con la
// moneda anterior del viaje. The caller has already checked the trip.
export async function recalculateExpenseConversions(tripId: string, tripCurrency: string) {
  const expenses = await prisma.expense.findMany({
    where: { tripId },
    select: { id: true, currency: true, amount: true },
  });

  await Promise.all(
    expenses.map(async (expense) => {
      const { exchangeRate, convertedAmount } = await resolveConversion(expense.currency, tripCurrency, expense.amount);
      await prisma.expense.update({ where: { id: expense.id }, data: { exchangeRate, convertedAmount } });
    }),
  );
}

export async function createExpense(actor: Actor, tripId: string, input: ExpenseInput) {
  const trip = await requireTrip(actor, tripId);
  const data = parseInput(expenseInputSchema, input);
  const conversion = await resolveConversion(data.currency ?? DEFAULT_CURRENCY, trip.currency, data.amount);
  const created = await auditedCreate(actor, { entity: "Expense", tripId }, (db, mark) =>
    db.expense.create({ data: { ...data, ...conversion, ...mark, tripId, date: toDate(data.date) } }),
  );
  revalidatePath(`/trips/${tripId}/expenses`);
  return created;
}

// The conversion depends on the amount and the currency: an edit that changes
// one of them takes the other from what is stored.
export async function updateExpense(actor: Actor, tripId: string, id: string, input: Partial<ExpenseInput>) {
  const trip = await requireTrip(actor, tripId);
  const data = parseInput(expenseInputSchema.partial(), input);

  let conversion: Awaited<ReturnType<typeof resolveConversion>> | undefined;
  if (data.amount !== undefined || data.currency !== undefined) {
    const stored =
      data.amount === undefined || data.currency === undefined
        ? await prisma.expense.findFirst({ where: { id, tripId }, select: { amount: true, currency: true } })
        : null;
    const amount = data.amount ?? stored?.amount;
    const currency = data.currency ?? stored?.currency;
    if (amount === undefined || currency === undefined) throw new NotFoundError("Expense");
    conversion = await resolveConversion(currency, trip.currency, amount);
  }

  await auditedUpdate(
    actor,
    { entity: "Expense", tripId, id },
    (db) => db.expense.findFirst({ where: { id, tripId } }),
    (db, mark) =>
      orNotFound(
        "Expense",
        db.expense.update({ where: { id, tripId }, data: { ...data, ...conversion, ...mark, date: toDate(data.date) } }),
      ),
  );
  revalidatePath(`/trips/${tripId}/expenses`);
}

export async function toggleExpensePaid(actor: Actor, tripId: string, id: string, paid: boolean) {
  await requireTrip(actor, tripId);
  await orNotFound("Expense", prisma.expense.update({ where: { id, tripId }, data: { paid, ...markOf(actor) } }));
  revalidatePath(`/trips/${tripId}/expenses`);
}

export async function deleteExpense(actor: Actor, tripId: string, id: string) {
  await requireTrip(actor, tripId);
  await orNotFound("Expense", prisma.expense.delete({ where: { id, tripId } }));
  revalidatePath(`/trips/${tripId}/expenses`);
}
