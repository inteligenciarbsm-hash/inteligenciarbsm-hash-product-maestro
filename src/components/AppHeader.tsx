import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";

const APP_VERSION = "v1.34";

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

const navItemBase =
  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/70";
const navItemActive = "text-primary bg-primary/[0.07]";

const NavItems = () => (
  <>
    <NavLink to="/pesquisas" className={navItemBase} activeClassName={navItemActive}>
      Análise de produto
    </NavLink>
    <NavLink to="/comparativo" className={navItemBase} activeClassName={navItemActive}>
      Comparativo
    </NavLink>
    <NavLink to="/pesquisas-sac" className={navItemBase} activeClassName={navItemActive}>
      Pesquisas do SAC
    </NavLink>
    <NavLink to="/central-sac" className={navItemBase} activeClassName={navItemActive}>
      Central SAC
    </NavLink>
  </>
);

const AppHeader = () => {
  const { user, signOut } = useAuth();

  return (
    <>
      {/* Sidebar — md+ */}
      <aside className="no-print hidden md:flex md:fixed md:inset-y-0 md:left-0 md:z-30 md:w-64 md:flex-col md:border-r md:border-border/70 md:bg-card md:p-5">
        <ZuppaMark />

        <nav className="mt-8 flex flex-col gap-1">
          <NavItems />
        </nav>

        <div className="flex-1" />

        <div className="space-y-2 border-t border-border/70 pt-4">
          <div className="flex items-center justify-between">
            <span className="font-display text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {APP_VERSION}
            </span>
          </div>
          <div className="text-xs text-muted-foreground truncate" title={user?.email}>
            {user?.email}
          </div>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => signOut()}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </aside>

      {/* Top bar — mobile (< md) */}
      <header className="no-print md:hidden sticky top-0 z-30 border-b border-border/70 bg-card/85 backdrop-blur-md">
        <div className="container flex items-center gap-3 py-3">
          <ZuppaMark />
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <nav className="container flex items-center gap-1 overflow-x-auto pb-2 -mt-1">
          <NavItems />
        </nav>
      </header>
    </>
  );
};

export default AppHeader;
