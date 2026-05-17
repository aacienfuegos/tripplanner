import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { approveUser, denyUser, revokeUser, setRegistrationOpen } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserCheck, UserX, Users, Globe, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail || session?.user?.email !== adminEmail) redirect("/dashboard");

  const [pendingUsers, approvedUsers, deniedUsers, settings] = await Promise.all([
    prisma.user.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ where: { status: "APPROVED" }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ where: { status: "DENIED" }, orderBy: { createdAt: "desc" } }),
    prisma.settings.findUnique({ where: { id: "global" } }),
  ]);

  const registrationOpen = settings?.registrationOpen ?? false;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestiona el acceso a TripPlanner</p>
      </div>

      {/* Configuración de registro */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Modo de registro</CardTitle>
          <CardDescription>
            Controla quién puede registrarse en la aplicación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {registrationOpen ? (
                <>
                  <Globe className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Registro abierto</span>
                  <Badge variant="outline" className="text-green-600 border-green-600">Activo</Badge>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">Registro restringido</span>
                  <Badge variant="outline" className="text-orange-600 border-orange-600">Activo</Badge>
                </>
              )}
            </div>
            <form action={setRegistrationOpen}>
              <input type="hidden" name="open" value={(!registrationOpen).toString()} />
              <Button type="submit" variant="outline" size="sm">
                {registrationOpen ? "Cerrar registro" : "Abrir registro"}
              </Button>
            </form>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {registrationOpen
              ? "Cualquier persona que inicie sesión obtendrá acceso automáticamente."
              : "Los nuevos usuarios quedan pendientes hasta que los apruebes manualmente."}
          </p>
        </CardContent>
      </Card>

      {/* Solicitudes pendientes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Solicitudes pendientes</CardTitle>
            {pendingUsers.length > 0 && (
              <Badge>{pendingUsers.length}</Badge>
            )}
          </div>
          <CardDescription>Usuarios que esperan aprobación</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay solicitudes pendientes</p>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((user, i) => (
                <div key={user.id}>
                  {i > 0 && <Separator className="mb-3" />}
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.name ?? "Sin nombre"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <form action={approveUser}>
                        <input type="hidden" name="userId" value={user.id} />
                        <Button type="submit" size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50">
                          <UserCheck className="h-3.5 w-3.5 mr-1" />
                          Aprobar
                        </Button>
                      </form>
                      <form action={denyUser}>
                        <input type="hidden" name="userId" value={user.id} />
                        <Button type="submit" size="sm" variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                          <UserX className="h-3.5 w-3.5 mr-1" />
                          Denegar
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usuarios aprobados */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Usuarios aprobados</CardTitle>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-sm">{approvedUsers.length}</span>
            </div>
          </div>
          <CardDescription>Usuarios con acceso activo</CardDescription>
        </CardHeader>
        <CardContent>
          {approvedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Ningún usuario aprobado todavía</p>
          ) : (
            <div className="space-y-3">
              {approvedUsers.map((user, i) => (
                <div key={user.id}>
                  {i > 0 && <Separator className="mb-3" />}
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.name ?? "Sin nombre"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    {user.email !== adminEmail && (
                      <form action={revokeUser}>
                        <input type="hidden" name="userId" value={user.id} />
                        <Button type="submit" size="sm" variant="ghost" className="text-muted-foreground hover:text-red-600">
                          Revocar
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usuarios denegados */}
      {deniedUsers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Usuarios denegados</CardTitle>
            <CardDescription>Usuarios con acceso bloqueado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deniedUsers.map((user, i) => (
                <div key={user.id}>
                  {i > 0 && <Separator className="mb-3" />}
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.name ?? "Sin nombre"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <form action={approveUser}>
                      <input type="hidden" name="userId" value={user.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        Restaurar
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
