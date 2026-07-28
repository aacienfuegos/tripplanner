import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { approveUser, denyUser, revokeUser, setRegistrationOpen } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserCheck, UserX, Users, Globe, Lock } from "lucide-react";
import { getT } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!currentUser?.isAdmin) redirect("/dashboard");

  const [t, pendingUsers, approvedUsers, deniedUsers, settings] = await Promise.all([
    getT(),
    prisma.user.findMany({ where: { status: "PENDING" }, select: { id: true, name: true, email: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ where: { status: "APPROVED" }, select: { id: true, name: true, email: true, isAdmin: true }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ where: { status: "DENIED" }, select: { id: true, name: true, email: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.settings.findUnique({ where: { id: "global" } }),
  ]);

  const registrationOpen = settings?.registrationOpen ?? false;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t.navAdmin}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.adminPanelSubtitle}</p>
      </div>

      {/* Configuración de registro */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.registrationModeTitle}</CardTitle>
          <CardDescription>
            {t.registrationModeDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {registrationOpen ? (
                <>
                  <Globe className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{t.registrationOpenLabel}</span>
                  <Badge variant="success">{t.activeLabel}</Badge>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">{t.registrationRestrictedLabel}</span>
                  <Badge variant="warning">{t.activeLabel}</Badge>
                </>
              )}
            </div>
            <form action={setRegistrationOpen}>
              <input type="hidden" name="open" value={(!registrationOpen).toString()} />
              <Button type="submit" variant="outline" size="sm">
                {registrationOpen ? t.closeRegistrationBtn : t.openRegistrationBtn}
              </Button>
            </form>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {registrationOpen ? t.registrationOpenHint : t.registrationRestrictedHint}
          </p>
        </CardContent>
      </Card>

      {/* Solicitudes pendientes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t.pendingRequestsTitle}</CardTitle>
            {pendingUsers.length > 0 && (
              <Badge>{pendingUsers.length}</Badge>
            )}
          </div>
          <CardDescription>{t.pendingRequestsDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t.noPendingRequests}</p>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((user, i) => (
                <div key={user.id}>
                  {i > 0 && <Separator className="mb-3" />}
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.name ?? t.noNameLabel}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.createdAt.toLocaleDateString(t.dateLocale, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <form action={approveUser}>
                        <input type="hidden" name="userId" value={user.id} />
                        <Button type="submit" size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50">
                          <UserCheck className="h-3.5 w-3.5 mr-1" />
                          {t.approveBtn}
                        </Button>
                      </form>
                      <form action={denyUser}>
                        <input type="hidden" name="userId" value={user.id} />
                        <Button type="submit" size="sm" variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                          <UserX className="h-3.5 w-3.5 mr-1" />
                          {t.denyBtn}
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
            <CardTitle className="text-base">{t.approvedUsersTitle}</CardTitle>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-sm">{approvedUsers.length}</span>
            </div>
          </div>
          <CardDescription>{t.approvedUsersDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {approvedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t.noApprovedUsers}</p>
          ) : (
            <div className="space-y-3">
              {approvedUsers.map((user, i) => (
                <div key={user.id}>
                  {i > 0 && <Separator className="mb-3" />}
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.name ?? t.noNameLabel}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    {!user.isAdmin && (
                      <form action={revokeUser}>
                        <input type="hidden" name="userId" value={user.id} />
                        <Button type="submit" size="sm" variant="ghost" className="text-muted-foreground hover:text-red-600">
                          {t.revokeBtn}
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
            <CardTitle className="text-base">{t.deniedUsersTitle}</CardTitle>
            <CardDescription>{t.deniedUsersDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deniedUsers.map((user, i) => (
                <div key={user.id}>
                  {i > 0 && <Separator className="mb-3" />}
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.name ?? t.noNameLabel}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <form action={approveUser}>
                      <input type="hidden" name="userId" value={user.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        {t.restoreBtn}
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
