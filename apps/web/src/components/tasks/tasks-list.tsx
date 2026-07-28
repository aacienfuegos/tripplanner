"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Plus, ClipboardList, Pencil, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { TaskForm } from "./task-form";
import { deleteTask, toggleTaskDone } from "@/actions/tasks";
import type { Task, TaskPriority } from "@/types";
import { cn } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";
import type { Locale } from "date-fns";

const priorityOrder: Record<TaskPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const po = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (po !== 0) return po;
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export function TasksList({ tripId, tasks }: { tripId: string; tasks: Task[] }) {
  const { t } = useT();
  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const priorityConfig: Record<TaskPriority, { label: string; cls: string }> = {
    HIGH:   { label: t.priorityHigh,   cls: "border-red-300 text-red-600" },
    MEDIUM: { label: t.priorityMedium, cls: "border-yellow-300 text-yellow-600" },
    LOW:    { label: t.priorityLow,    cls: "border-blue-300 text-blue-500" },
  };

  async function handleToggle(task: Task) {
    try { await toggleTaskDone(tripId, task.id, !task.done); }
    catch { toast.error(t.error); }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t.confirmDeleteTask,
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try { await deleteTask(tripId, id); toast.success(t.taskDeletedToast); }
    catch { toast.error(t.error); }
  }

  const sorted = sortTasks(tasks);
  const pending = sorted.filter((task) => !task.done);
  const done    = sorted.filter((task) => task.done);

  return (
    <div className="space-y-4">
      <Button onClick={() => { setEditing(null); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> {t.addTask}
      </Button>

      {tasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noTasks}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div className="space-y-2">
              {pending.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  priorityConfig={priorityConfig}
                  dfLocale={dfLocale}
                  onToggle={() => handleToggle(task)}
                  onEdit={() => { setEditing(task); setOpen(true); }}
                  onDelete={() => handleDelete(task.id)}
                />
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t.completedCountLabel(done.length)}
              </p>
              {done.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  priorityConfig={priorityConfig}
                  dfLocale={dfLocale}
                  onToggle={() => handleToggle(task)}
                  onEdit={() => { setEditing(task); setOpen(true); }}
                  onDelete={() => handleDelete(task.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t.editTask : t.addTask}</DialogTitle>
          </DialogHeader>
          <TaskForm tripId={tripId} task={editing ?? undefined} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}

function TaskRow({
  task, priorityConfig, dfLocale, onToggle, onEdit, onDelete,
}: {
  task: Task;
  priorityConfig: Record<TaskPriority, { label: string; cls: string }>;
  dfLocale: Locale;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pc = priorityConfig[task.priority];

  return (
    <Card className={cn("transition-opacity", task.done && "opacity-60")}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onToggle}
            className={cn(
              "mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
              task.done
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/40 hover:border-primary",
            )}
          >
            {task.done && (
              <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current">
                <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("font-medium", task.done && "line-through text-muted-foreground")}>
                {task.title}
              </span>
              <Badge variant="outline" className={cn("text-xs h-4 px-1", pc.cls)}>
                {pc.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {task.dueDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(task.dueDate, "d MMM yyyy", { locale: dfLocale })}
                </span>
              )}
              {task.notes && <span className="italic truncate">{task.notes}</span>}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon-sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
