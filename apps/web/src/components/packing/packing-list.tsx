"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, ShoppingBag, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPackingItem, togglePackingItem, deletePackingItem, addDefaultPackingItems } from "@/actions/packing";
import type { PackingItem } from "@/types";
import { useT } from "@/contexts/LanguageContext";

interface Props { tripId: string; items: PackingItem[]; }

export function PackingList({ tripId, items }: Props) {
  const { t } = useT();
  const [showForm, setShowForm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const PRESET_CATEGORIES = t.locale === "es"
    ? ["Documentos", "Ropa", "Calzado", "Higiene", "Medicamentos", "Electrónica", "Accesorios", "Entretenimiento", "Comida y bebida"]
    : ["Documents", "Clothing", "Footwear", "Toiletries", "Medication", "Electronics", "Accessories", "Entertainment", "Food & drinks"];

  const OTHER_LABEL = t.locale === "es" ? "Otro" : "Other";

  const categories = [
    ...new Set([...PRESET_CATEGORIES, ...items.map((i) => i.category)]),
    OTHER_LABEL,
  ];

  if (!selectedCategory && categories.length > 0) {
    // lazy init
  }
  const activeCategory = selectedCategory || PRESET_CATEGORIES[0];

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PackingItem[]>);

  const total = items.length;
  const packed = items.filter((i) => i.packed).length;

  async function handleToggle(id: string, current: boolean) {
    try { await togglePackingItem(tripId, id, !current); }
    catch { toast.error(t.error); }
  }

  async function handleDelete(id: string) {
    try { await deletePackingItem(tripId, id); }
    catch { toast.error(t.error); }
  }

  async function handleAddDefaults() {
    setIsPending(true);
    try {
      await addDefaultPackingItems(tripId);
      toast.success(t.locale === "es" ? "Lista base añadida" : "Default list added");
    }
    catch { toast.error(t.error); }
    finally { setIsPending(false); }
  }

  async function handleCreate(formData: FormData) {
    const category = activeCategory === OTHER_LABEL ? customCategory.trim() : activeCategory;
    if (!category) { toast.error(t.locale === "es" ? "Indica una categoría" : "Enter a category"); return; }
    formData.set("category", category);
    try { await createPackingItem(tripId, formData); formRef.current?.reset(); setCustomCategory(""); }
    catch { toast.error(t.error); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" /> {t.addPackingItem}
        </Button>
        {items.length === 0 && (
          <Button variant="outline" onClick={handleAddDefaults} disabled={isPending}>
            <Wand2 className="h-4 w-4 mr-2" />
            {t.locale === "es" ? "Añadir lista base" : "Add default list"}
          </Button>
        )}
        {total > 0 && (
          <span className="text-sm text-muted-foreground">
            {packed}/{total} {t.locale === "es" ? `empaquetado${packed !== 1 ? "s" : ""}` : `packed`}
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
            <form ref={formRef} action={handleCreate} className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-32">
                  <Label htmlFor="name" className="sr-only">{t.locale === "es" ? "Item" : "Item"}</Label>
                  <Input id="name" name="name" placeholder={t.locale === "es" ? "Nombre del item" : "Item name"} required />
                </div>
                <Input name="quantity" type="number" defaultValue="1" className="w-20" min="1" />
              </div>
              <div className="flex gap-3 flex-wrap items-start">
                <div className="flex-1 min-w-36">
                  <Select value={activeCategory} onValueChange={(v) => v !== null && setSelectedCategory(v)}>
                    <SelectTrigger><SelectValue placeholder={t.packingCategory} /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {activeCategory === OTHER_LABEL && (
                  <Input
                    className="flex-1 min-w-28"
                    placeholder={t.locale === "es" ? "Nombre de categoría" : "Category name"}
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    required
                  />
                )}
                <Button type="submit">{t.add}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>{t.cancel}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <ShoppingBag className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noPackingItems}</p>
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
                  <div key={item.id} className="flex items-center gap-3 py-1.5 group">
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
