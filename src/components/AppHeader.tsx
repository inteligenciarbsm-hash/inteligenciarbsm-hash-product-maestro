import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";

const APP_VERSION = "v1.5";

const RBMark = () => (
  <Link to="/produtos" className="flex items-center gap-2 group">
    <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
      RB
    </div>
    <div className="leading-tight">
      <div className="text-sm font-semibold text-foreground group-hover:text-primary transition">
        Rede Brasil
      </div>
      <div className="text-[10px] text-muted-foreground -mt-0.5">SAC Marca Própria</div>
    </div>
  </Link>
);

const navTabClass =
  "px-3 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent";
const navTabActiveClass = "text-primary bg-accent/60";

const AppHeader = () => {
  const { user, signOut } = useAuth();

  return (
    <header className="border-b bg-card sticky top-0 z-30">
      <div className="container flex items-center gap-6 py-3">
        <RBMark />

        <nav className="flex items-center gap-1">
          <NavLink to="/produtos" className={navTabClass} activeClassName={navTabActiveClass}>
            Produtos
          </NavLink>
          <NavLink to="/chamados" className={navTabClass} activeClassName={navTabActiveClass}>
            Chamados
          </NavLink>
          <NavLink to="/pesquisas" className={navTabClass} activeClassName={navTabActiveClass}>
            Pesquisas
          </NavLink>
        </nav>

        <div className="flex-1" />

        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground hidden sm:inline">
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
