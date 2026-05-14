import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";

const APP_VERSION = "v1.22";

const ZuppaMark = () => (
  <Link to="/pesquisas" className="flex items-center gap-2.5 group">
    <img
      src="/zuppa.png"
      alt="Marca Própria"
      className="h-9 w-9 rounded-lg object-contain ring-1 ring-border/60 transition-transform group-hover:scale-105"
    />
    <div className="leading-none">
      <div className="font-display text-[15px] font-bold text-foreground group-hover:text-primary transition-colors">
        Marca Própria
      </div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mt-1">
        Análise Sensorial
      </div>
    </div>
  </Link>
);

const navTabClass =
  "px-3 py-2 text-sm font-medium rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/70";
const navTabActiveClass = "text-primary bg-primary/[0.07]";

const AppHeader = () => {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-card/85 backdrop-blur-md">
      <div className="container flex items-center gap-6 py-3">
        <ZuppaMark />

        <nav className="flex items-center gap-1">
          <NavLink to="/pesquisas" className={navTabClass} activeClassName={navTabActiveClass}>
            Análise de produto
          </NavLink>
          <NavLink to="/comparativo" className={navTabClass} activeClassName={navTabActiveClass}>
            Comparativo
          </NavLink>
        </nav>

        <div className="flex-1" />

        <span className="font-display text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground hidden sm:inline">
          {APP_VERSION}
        </span>
        <span className="text-sm text-muted-foreground hidden md:inline">{user?.email}</span>
        <Button variant="outline" size="sm" onClick={() => signOut()}>
          <LogOut className="h-4 w-4 mr-1" /> Sair
        </Button>
      </div>
    </header>
  );
};

export default AppHeader;
