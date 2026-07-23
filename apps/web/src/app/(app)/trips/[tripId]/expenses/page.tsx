import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExpensesList } from "@/components/expenses/expenses-list";
import { SectionHeader } from "@/components/layout/section-header";
import { DollarSign } from "lucide-react";

export default async function ExpensesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { expenses: { orderBy: { date: "desc" } } },
  });
  if (!trip || trip.userId !== session!.user!.id) notFound();

  const amountInTripCurrency = (e: (typeof trip.expenses)[number]) =>
    e.currency === trip.currency ? e.amount : (e.convertedAmount ?? e.amount);

  const total = trip.expenses.reduce((sum, e) => sum + amountInTripCurrency(e), 0);
  const paid = trip.expenses.filter((e) => e.paid).reduce((sum, e) => sum + amountInTripCurrency(e), 0);

  return (
    <div className="space-y-6">
      <SectionHeader tripId={trip.id} tripName={trip.name} title="Gastos" icon={<DollarSign className="h-5 w-5" />} />
      <ExpensesList
        tripId={trip.id}
        expenses={trip.expenses}
        currency={trip.currency}
        budget={trip.budget}
        total={total}
        paid={paid}
        tripStartDate={trip.startDate}
      />
    </div>
  );
}
