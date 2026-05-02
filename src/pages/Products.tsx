import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Package, LogOut } from "lucide-react";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  type Product,
} from "@/hooks/useProducts";
import { useAuth } from "@/contexts/AuthContext";

const productSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  sku: z.string().trim().max(100).optional().or(z.literal("")),
  category: z.string().trim().max(100).optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Preço inválido"),
  stock: z.coerce.number().int().min(0, "Estoque inválido"),
  weight: z.coerce.number().min(0).optional().nullable(),
  length_cm: z.coerce.number().min(0).optional().nullable(),
  width_cm: z.coerce.number().min(0).optional().nullable(),
  height_cm: z.coerce.number().min(0).optional().nullable(),
  variations: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

const emptyForm = {
  name: "", description: "", sku: "", category: "",
  price: "0", stock: "0", weight: "", length_cm: "", width_cm: "", height_cm: "",
  variations: "", is_active: true,
};

const Products = () => {
  const { user, signOut } = useAuth();
  const { data: products = [], isLoading, error } = useProducts();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      sku: p.sku ?? "",
      category: p.category ?? "",
      price: String(p.price),
      stock: String(p.stock),
      weight: p.weight != null ? String(p.weight) : "",
      length_cm: p.length_cm != null ? String(p.length_cm) : "",
      width_cm: p.width_cm != null ? String(p.width_cm) : "",
      height_cm: p.height_cm != null ? String(p.height_cm) : "",
      variations: Array.isArray(p.variations) && p.variations.length ? JSON.stringify(p.variations) : "",
      is_active: p.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = productSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    let variations: unknown[] = [];
    if (parsed.data.variations) {
      try {
        const v = JSON.parse(parsed.data.variations);
        if (!Array.isArray(v)) throw new Error();
        variations = v;
      } catch {
        toast.error("Variações devem ser um JSON array válido");
        return;
      }
    }
    const payload = {
      name: parsed.data.name,
      description: parsed.data.description || null,
      sku: parsed.data.sku || null,
      category: parsed.data.category || null,
      price: parsed.data.price,
      stock: parsed.data.stock,
      weight: parsed.data.weight ?? null,
      length_cm: parsed.data.length_cm ?? null,
      width_cm: parsed.data.width_cm ?? null,
      height_cm: parsed.data.height_cm ?? null,
      variations: variations as never,
      is_active: parsed.data.is_active,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, patch: payload });
        toast.success("Produto atualizado");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Produto criado");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar produto");
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
      toast.success("Produto excluído");
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir produto");
    }
  };

  const fmtBRL = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Cadastro de Produtos</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden md:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Produtos</h2>
            <p className="text-sm text-muted-foreground">
              Conectado ao Supabase — alterações são persistidas no banco.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Novo produto
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista ({products.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : error ? (
              <div className="text-center py-12 text-destructive">
                Erro ao carregar: {error instanceof Error ? error.message : "desconhecido"}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum produto. Clique em <strong>Novo produto</strong> para começar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground">{p.sku ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
                        <TableCell className="text-right">{fmtBRL(Number(p.price))}</TableCell>
                        <TableCell className="text-right">{p.stock}</TableCell>
                        <TableCell>
                          <Badge variant={p.is_active ? "default" : "secondary"}>
                            {p.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleting(p)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
            <DialogDescription>
              Preencha os dados do produto.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Categoria</Label>
                <Input id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price">Preço (R$) *</Label>
                <Input id="price" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock">Estoque *</Label>
                <Input id="stock" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weight">Peso (kg)</Label>
                <Input id="weight" type="number" step="0.001" min="0" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="length_cm">Comprimento (cm)</Label>
                <Input id="length_cm" type="number" step="0.01" min="0" value={form.length_cm} onChange={(e) => setForm({ ...form, length_cm: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="width_cm">Largura (cm)</Label>
                <Input id="width_cm" type="number" step="0.01" min="0" value={form.width_cm} onChange={(e) => setForm({ ...form, width_cm: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="height_cm">Altura (cm)</Label>
                <Input id="height_cm" type="number" step="0.01" min="0" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="variations">Variações (JSON array opcional)</Label>
                <Textarea
                  id="variations"
                  value={form.variations}
                  onChange={(e) => setForm({ ...form, variations: e.target.value })}
                  placeholder='Ex: [{"cor":"azul","tamanho":"M"}]'
                  rows={2}
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <Switch id="is_active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label htmlFor="is_active">Produto ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar produto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá <strong>{deleting?.name}</strong> do banco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Products;
