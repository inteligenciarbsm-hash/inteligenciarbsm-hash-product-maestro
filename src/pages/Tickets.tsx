import { useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, MessageSquare, Calendar, ShoppingBag } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { useProducts } from "@/hooks/useProducts";
import {
  useTickets, useCreateTicket, useUpdateTicket, useDeleteTicket,
  TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES,
  type Ticket,
} from "@/hooks/useTickets";

const ticketSchema = z.object({
  customer_name: z.string().trim().min(1, "Nome do cliente obrigatório").max(200),
  customer_email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  customer_phone: z.string().trim().max(40).optional().or(z.literal("")),
  store: z.string().trim().max(120).optional().or(z.literal("")),
  order_number: z.string().trim().max(80).optional().or(z.literal("")),
  product_id: z.string().optional().or(z.literal("")),
  category: z.enum(["defeito", "embalagem", "falta_item", "duvida", "sugestao", "outros"]),
  priority: z.enum(["baixa", "media", "alta"]),
  status: z.enum(["aberto", "em_andamento", "resolvido", "cancelado"]),
  description: z.string().trim().min(1, "Descreva o chamado").max(4000),
  resolution: z.string().trim().max(4000).optional().or(z.literal("")),
});

const emptyForm = {
  customer_name: "",
  customer_email: "",
  customer_phone: "",
  store: "",
  order_number: "",
  product_id: "",
  category: "outros" as const,
  priority: "media" as const,
  status: "aberto" as const,
  description: "",
  resolution: "",
};

const statusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "aberto": return "default";
    case "em_andamento": return "secondary";
    case "resolvido": return "outline";
    case "cancelado": return "destructive";
    default: return "outline";
  }
};

const priorityColor = (priority: string) => {
  switch (priority) {
    case "alta": return "text-destructive";
    case "media": return "text-amber-600";
    case "baixa": return "text-muted-foreground";
    default: return "text-muted-foreground";
  }
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const Tickets = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: tickets = [], isLoading, error } = useTickets(statusFilter);
  const { data: products = [] } = useProducts();
  const createMutation = useCreateTicket();
  const updateMutation = useUpdateTicket();
  const deleteMutation = useDeleteTicket();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [deleting, setDeleting] = useState<Ticket | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  const productMap = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [products]);

  const counts = useMemo(() => {
    const base = { aberto: 0, em_andamento: 0, resolvido: 0, cancelado: 0, total: tickets.length };
    tickets.forEach((t) => {
      if (t.status in base) (base as Record<string, number>)[t.status]++;
    });
    return base;
  }, [tickets]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: Ticket) => {
    setEditing(t);
    setForm({
      customer_name: t.customer_name,
      customer_email: t.customer_email ?? "",
      customer_phone: t.customer_phone ?? "",
      store: t.store ?? "",
      order_number: t.order_number ?? "",
      product_id: t.product_id ?? "",
      category: t.category as typeof emptyForm.category,
      priority: t.priority as typeof emptyForm.priority,
      status: t.status as typeof emptyForm.status,
      description: t.description,
      resolution: t.resolution ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ticketSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const payload = {
      customer_name: parsed.data.customer_name,
      customer_email: parsed.data.customer_email || null,
      customer_phone: parsed.data.customer_phone || null,
      store: parsed.data.store || null,
      order_number: parsed.data.order_number || null,
      product_id: parsed.data.product_id || null,
      category: parsed.data.category,
      priority: parsed.data.priority,
      status: parsed.data.status,
      description: parsed.data.description,
      resolution: parsed.data.resolution || null,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, patch: payload });
        toast.success("Chamado atualizado");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Chamado criado");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar chamado");
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
      toast.success("Chamado excluído");
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir chamado");
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">Chamados do SAC</h2>
            <p className="text-sm text-muted-foreground">
              Reclamações, dúvidas e sugestões sobre produtos da marca própria.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Novo chamado
          </Button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard label="Total" value={counts.total} accent="bg-muted" />
          <SummaryCard label="Abertos" value={counts.aberto} accent="bg-primary/10 text-primary" />
          <SummaryCard label="Em andamento" value={counts.em_andamento} accent="bg-amber-100 text-amber-700" />
          <SummaryCard label="Resolvidos" value={counts.resolvido} accent="bg-emerald-100 text-emerald-700" />
          <SummaryCard label="Cancelados" value={counts.cancelado} accent="bg-rose-100 text-rose-700" />
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Lista
            </CardTitle>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                {TICKET_STATUSES.map((s) => (
                  <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : error ? (
              <div className="text-center py-12 text-destructive">
                Erro ao carregar: {error instanceof Error ? error.message : "desconhecido"}
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum chamado neste filtro. Clique em <strong>Novo chamado</strong>.
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg border p-4 hover:border-primary/40 transition cursor-pointer space-y-2"
                    onClick={() => openEdit(t)}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{t.customer_name}</span>
                          <Badge variant={statusBadgeVariant(t.status)}>
                            {TICKET_STATUSES.find((s) => s.value === t.status)?.label ?? t.status}
                          </Badge>
                          <Badge variant="outline" className={priorityColor(t.priority)}>
                            {TICKET_PRIORITIES.find((p) => p.value === t.priority)?.label ?? t.priority}
                          </Badge>
                          <Badge variant="secondary">
                            {TICKET_CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {t.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          {t.product_id && productMap.has(t.product_id) && (
                            <span className="flex items-center gap-1">
                              <ShoppingBag className="h-3 w-3" />
                              {productMap.get(t.product_id)}
                            </span>
                          )}
                          {t.store && <span>Loja: {t.store}</span>}
                          {t.order_number && <span>Pedido: {t.order_number}</span>}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {fmtDate(t.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(t)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar chamado" : "Novo chamado"}</DialogTitle>
            <DialogDescription>
              Registre os dados do consumidor e o motivo do contato.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="customer_name">Nome do cliente *</Label>
                <Input
                  id="customer_name"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  required
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer_email">E-mail</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer_phone">Telefone</Label>
                <Input
                  id="customer_phone"
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store">Loja</Label>
                <Input
                  id="store"
                  value={form.store}
                  onChange={(e) => setForm({ ...form, store: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="order_number">Número do pedido</Label>
                <Input
                  id="order_number"
                  value={form.order_number}
                  onChange={(e) => setForm({ ...form, order_number: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label>Produto relacionado</Label>
                <Select
                  value={form.product_id || "none"}
                  onValueChange={(v) => setForm({ ...form, product_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoria *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as typeof emptyForm.category })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade *</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v as typeof emptyForm.priority })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label>Status *</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as typeof emptyForm.status })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="description">Descrição *</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                  rows={4}
                  maxLength={4000}
                  placeholder="O que o cliente relatou?"
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="resolution">Resolução</Label>
                <Textarea
                  id="resolution"
                  value={form.resolution}
                  onChange={(e) => setForm({ ...form, resolution: e.target.value })}
                  rows={3}
                  maxLength={4000}
                  placeholder="Preencha quando o chamado for fechado"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar chamado"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir chamado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o chamado de <strong>{deleting?.customer_name}</strong> do banco.
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

const SummaryCard = ({ label, value, accent }: { label: string; value: number; accent: string }) => (
  <div className={`rounded-lg border p-4 ${accent}`}>
    <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
    <div className="text-2xl font-bold mt-1">{value}</div>
  </div>
);

export default Tickets;
