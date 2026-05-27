"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTask, updateTask } from "@/actions/tasks";
import type { Task } from "@/types";
import { format } from "date-fns";

interface Props { tripId: string; task?: Task; onSuccess: () => void; }

export function TaskForm({ tripId, task: initialTask, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (initialTask) { await updateTask(tripId, initialTask.id, formData); toast.success("Tarea actualizada"); }
        else { await createTask(tripId, formData); toast.success("Tarea añadida"); }
        onSuccess();
      } catch { toast.error("Error al guardar"); }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Título *</Label>
        <Input id="title" name="title" required defaultValue={initialTask?.title} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="priority">Prioridad</Label>
          <Select name="priority" defaultValue={initialTask?.priority ?? "MEDIUM"}>
            <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="HIGH">Alta</SelectItem>
              <SelectItem value="MEDIUM">Media</SelectItem>
              <SelectItem value="LOW">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dueDate">Fecha límite</Label>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={initialTask?.dueDate ? format(initialTask.dueDate, "yyyy-MM-dd") : ""}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={initialTask?.notes ?? ""} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : initialTask ? "Guardar cambios" : "Añadir tarea"}
      </Button>
    </form>
  );
}
