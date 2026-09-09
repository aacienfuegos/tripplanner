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
import { useT } from "@/contexts/LanguageContext";

interface Props { tripId: string; task?: Task; onSuccess: () => void; }

export function TaskForm({ tripId, task: initialTask, onSuccess }: Props) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (initialTask) { await updateTask(tripId, initialTask.id, formData); toast.success(t.taskUpdatedToast); }
        else { await createTask(tripId, formData); toast.success(t.taskAddedToast); }
        onSuccess();
      } catch { toast.error(t.toastErrorSaving); }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">{t.taskTitle} *</Label>
        <Input id="title" name="title" required defaultValue={initialTask?.title} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="priority">{t.taskPriority}</Label>
          <Select name="priority" defaultValue={initialTask?.priority ?? "MEDIUM"}>
            <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="HIGH">{t.priorityHigh}</SelectItem>
              <SelectItem value="MEDIUM">{t.priorityMedium}</SelectItem>
              <SelectItem value="LOW">{t.priorityLow}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dueDate">{t.taskDueDate}</Label>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={initialTask?.dueDate ? format(initialTask.dueDate, "yyyy-MM-dd") : ""}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t.taskNotes}</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={initialTask?.notes ?? ""} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? t.savingEllipsis : initialTask ? t.saveChanges : t.addTask}
      </Button>
    </form>
  );
}
