"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, ShoppingBag, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPackingItem, togglePackingItem, deletePackingItem, addDefaultPackingItems } from "@/actions/packing";
import type { PackingItem } from "@/types";

interface Props { tripId: string; items: PackingItem[]; }

export function PackingList({ tripId, items }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PackingItem[]>);

  const total = items.length;
  const packed = items.filter((i) => i.packed).length;

  async function handleToggle(id: string, current: boolean) {
    try { await togglePackingItem(tripId, id, !current); }
    catch { toast.error("Error"); }
  }

  async function handleDelete(id: string) {
    try { await deletePackingItem(tripId, id); }
    catch { toast.error("Error al eliminar"); }
  }

  async function handleAddDefaults() {
    setIsPending(true);
    try { await addDefaultPackingItems(tripId); toast.success("Lista base añadida"); }
    catch { toast.error("Error"); }
    finally { setIsPending(false); }
  }

  async function handleCreate(formData: FormData) {
    try { await createPackingItem(tripId, formData); setShowForm(false); }
    catch { toast.error("Error al añadir"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" /> Añadir item
        </Button>
        {items.length === 0 && (
          <Button variant="outline" onClick={handleAddDefaults} disabled={isPending}>
            <Wand2 className="h-4 w-4 mr-2" /> Añadir lista base
          </Button>
        )}
        {total > 0 && (
          <span className="text-sm text-muted-foreground">
            {packed}/{total} empaquetado{packed !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${(packed / total) * 100}%` }}
          />
        </div>
      )}

      {showForm && (
        <Card>
          <CardContent className="pt-4">
            <form action={handleCreate} className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-32">
                <Label htmlFor="name" className="sr-only">Item</Label>
                <Input id="name" name="name" placeholder="Nombre del item" required />
              </div>
              <div className="flex-1 min-w-28">
                <Label htmlFor="category" className="sr-only">Categoría</Label>
                <Input id="category" name="category" placeholder="Categoría" required />
              </div>
              <Input name="quantity" type="number" defaultValue="1" className="w-20" min="1" />
              <Button type="submit">Añadir</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <ShoppingBag className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>Lista de equipaje vacía</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, catItems]) => (
            <Card key={category}>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {category} ({catItems.filter(i => i.packed).length}/{catItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                {catItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-1.5 group"
                  >
                    <input
                      type="checkbox"
                      checked={item.packed}
                      onChange={() => handleToggle(item.id, item.packed)}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <span className={`flex-1 text-sm ${item.packed ? "line-through text-muted-foreground" : ""}`}>
                      {item.name}
                      {item.quantity > 1 && <span className="text-muted-foreground ml-1">×{item.quantity}</span>}
                    </span>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
