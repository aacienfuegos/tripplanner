import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      createdAt: true,
      isAdmin: true,
      _count: { select: { trips: true } },
    },
  });

  if (!user) redirect("/auth/signin");

  const initials = user.name
    ? user.name.trim().split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user.email?.[0].toUpperCase() ?? "U";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Perfil</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Tu cuenta y preferencias</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
        <Card className="md:col-span-2">
          <CardContent className="p-6 flex flex-col items-center text-center gap-5">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? "Usuario"} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-base leading-tight">{user.name ?? "Sin nombre"}</p>
              <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-[220px]">{user.email}</p>
              {user.isAdmin && <Badge variant="secondary" className="mt-1.5">Admin</Badge>}
            </div>
            <div className="grid grid-cols-2 divide-x border rounded-md text-center text-sm w-full">
              <div className="py-3 px-2">
                <p className="text-xs text-muted-foreground">Viaje{user._count.trips !== 1 ? "s" : ""}</p>
                <p className="font-semibold text-base mt-0.5">
                  <Link href="/trips" className="hover:underline">{user._count.trips}</Link>
                </p>
              </div>
              <div className="py-3 px-2">
                <p className="text-xs text-muted-foreground">Miembro desde</p>
                <p className="font-semibold text-base capitalize mt-0.5">
                  {format(user.createdAt, "MMM yy", { locale: es })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-3">
          <ProfileForm
            key={`${user.name ?? ""}-${user.image ?? ""}`}
            user={{ name: user.name, image: user.image }}
          />
        </div>
      </div>
    </div>
  );
}
