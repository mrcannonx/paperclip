import { useEffect, useMemo, useState } from "react";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { EmptyState } from "../components/EmptyState";
import { Server, ExternalLink, RefreshCw, Circle, Smartphone, Globe, HardDrive, ChevronDown, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Service {
  slug: string;
  name: string;
  url: string;
  type: "ios" | "saas" | "infra" | "web" | "servcall";
  status: "live" | "active" | "failed" | "unknown";
  description?: string;
}

/* ------------------------------------------------------------------ */
/*  Static infrastructure services (not in Factory API)               */
/* ------------------------------------------------------------------ */

const INFRA_SERVICES: Service[] = [
  { slug: "paperclip", name: "Paperclip", url: "https://paperclip.aiappnation.com", type: "infra", status: "live", description: "Agent orchestration & task management" },
  { slug: "factory-api", name: "Factory API", url: "https://api.aiappnation.com", type: "infra", status: "live", description: "AI Factory backend gateway" },
  { slug: "storage", name: "MinIO Storage", url: "https://storage.aiappnation.com", type: "infra", status: "live", description: "Object storage console" },
  { slug: "console", name: "MinIO Console", url: "https://console.aiappnation.com", type: "infra", status: "live", description: "Storage admin UI" },
  { slug: "vector", name: "Qdrant", url: "https://vector.aiappnation.com", type: "infra", status: "live", description: "Vector database dashboard" },
  { slug: "auth", name: "Authentik", url: "https://auth.aiappnation.com", type: "infra", status: "live", description: "Identity & SSO provider" },
  { slug: "automation", name: "n8n", url: "https://automation.aiappnation.com", type: "infra", status: "live", description: "Workflow automation" },
];

/* ------------------------------------------------------------------ */
/*  ServCall services                                                  */
/* ------------------------------------------------------------------ */

const SERVCALL_SERVICES: Service[] = [
  { slug: "servcall-web", name: "ServCall Web", url: "https://servcall.ai", type: "servcall", status: "live", description: "Main marketing & app site" },
  { slug: "servcall-app", name: "ServCall App", url: "https://app.servcall.ai", type: "servcall", status: "live", description: "Dashboard & workspace portal" },
  { slug: "servcall-api", name: "ServCall API", url: "https://api.servcall.ai", type: "servcall", status: "live", description: "Backend API (FastAPI)" },
  { slug: "servcall-voice", name: "ServCall Voice", url: "https://voice.servcall.ai", type: "servcall", status: "live", description: "Retell voice agent proxy" },
  { slug: "servcall-mikes", name: "Mikes Roofing", url: "https://mikes-roofing.servcall.ai", type: "servcall", status: "live", description: "Provisioned site — Roofing" },
];

const SERVCALL_API = "https://api.servcall.ai";

async function fetchServCallSites(): Promise<Service[]> {
  try {
    const res = await fetch(`${SERVCALL_API}/public/sites`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data as Array<Record<string, unknown>>).map((site) => ({
      slug: `servcall-${site.site_slug}`,
      name: (site.business_name ?? site.name) as string,
      url: `https://${site.site_slug}.servcall.ai`,
      type: "servcall" as const,
      status: "live" as const,
      description: `Provisioned site — ${(site.trade_type as string) ?? "Business"}`,
    }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Factory API fetch                                                  */
/* ------------------------------------------------------------------ */

const FACTORY_API = "https://api.aiappnation.com/v1/factory/apps";

async function fetchFactoryApps(): Promise<Service[]> {
  const res = await fetch(FACTORY_API);
  if (!res.ok) return [];
  const data = await res.json();
  return (data as Array<Record<string, unknown>>).map((app) => ({
    slug: app.slug as string,
    name: (app.display_name ?? app.name) as string,
    url: (app.landing_url ?? "") as string,
    type: (app.pipeline_type === "ios" ? "ios" : app.pipeline_type === "saas" ? "saas" : "web") as Service["type"],
    status: (app.status === "live" ? "live" : app.status === "active" ? "active" : "failed") as Service["status"],
  }));
}

/* ------------------------------------------------------------------ */
/*  Health check                                                       */
/* ------------------------------------------------------------------ */

async function checkHealth(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: "HEAD", mode: "no-cors", signal: controller.signal });
    clearTimeout(timeout);
    // no-cors always returns opaque response with status 0
    return res.type === "opaque" || res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Filter pills                                                       */
/* ------------------------------------------------------------------ */

type FilterType = "all" | "ios" | "saas" | "infra" | "web" | "servcall";

const FILTERS: { value: FilterType; label: string; icon: typeof Globe }[] = [
  { value: "all", label: "All", icon: Server },
  { value: "infra", label: "Infrastructure", icon: HardDrive },
  { value: "servcall", label: "ServCall", icon: Phone },
  { value: "ios", label: "iOS", icon: Smartphone },
  { value: "saas", label: "SaaS", icon: Globe },
];

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */

function StatusDot({ status, healthy }: { status: Service["status"]; healthy?: boolean }) {
  // If we have health data, use that; otherwise fall back to API status
  const isUp = healthy ?? (status === "live" || status === "active");
  return (
    <span className="relative flex h-2.5 w-2.5">
      {isUp && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      )}
      <span
        className={cn(
          "relative inline-flex h-2.5 w-2.5 rounded-full",
          isUp ? "bg-emerald-500" : "bg-red-500",
        )}
      />
    </span>
  );
}

function TypeBadge({ type }: { type: Service["type"] }) {
  const config = {
    ios: { label: "iOS", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    saas: { label: "SaaS", className: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    infra: { label: "Infra", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    web: { label: "Web", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    servcall: { label: "ServCall", className: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
  };
  const c = config[type] ?? config.web;
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium", c.className)}>
      {c.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Service card                                                       */
/* ------------------------------------------------------------------ */

function ServiceCard({ service, healthy }: { service: Service; healthy?: boolean }) {
  return (
    <a
      href={service.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-all hover:border-foreground/20 hover:shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <StatusDot status={service.status} healthy={healthy} />
          <h3 className="text-sm font-semibold text-foreground">{service.name}</h3>
        </div>
        <TypeBadge type={service.type} />
      </div>

      {service.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-[11px] text-muted-foreground/70 truncate max-w-[70%]">
          {service.url.replace(/^https?:\/\//, "")}
        </span>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
      </div>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export function Infrastructure() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const [filter, setFilter] = useState<FilterType>("all");
  const [services, setServices] = useState<Service[]>(INFRA_SERVICES);
  const [healthMap, setHealthMap] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Infrastructure" }]);
  }, [setBreadcrumbs]);

  // Fetch factory apps + servcall sites on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [apps, dynamicSites] = await Promise.all([fetchFactoryApps(), fetchServCallSites()]);
        if (!cancelled) {
          // Merge: infra first, then servcall, then factory apps (deduplicated)
          const knownSlugs = new Set([
            ...INFRA_SERVICES.map((s) => s.slug),
            ...SERVCALL_SERVICES.map((s) => s.slug),
          ]);
          // Merge dynamic servcall sites that aren't already in the static list
          const servcallSlugs = new Set(SERVCALL_SERVICES.map((s) => s.slug));
          const newSites = dynamicSites.filter((s) => !servcallSlugs.has(s.slug));
          const allServCall = [...SERVCALL_SERVICES, ...newSites];
          // Add all servcall slugs to known
          for (const s of allServCall) knownSlugs.add(s.slug);
          const merged = [
            ...INFRA_SERVICES,
            ...allServCall,
            ...apps.filter((a) => !knownSlugs.has(a.slug)),
          ];
          setServices(merged);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Run health checks after services load
  useEffect(() => {
    if (loading || services.length === 0) return;
    let cancelled = false;
    setChecking(true);
    (async () => {
      const results = new Map<string, boolean>();
      await Promise.all(
        services.map(async (s) => {
          const ok = await checkHealth(s.url);
          results.set(s.slug, ok);
        }),
      );
      if (!cancelled) {
        setHealthMap(results);
        setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, services]);

  const filtered = useMemo(
    () => (filter === "all" ? services : services.filter((s) => s.type === filter)),
    [services, filter],
  );

  const stats = useMemo(() => {
    const total = services.length;
    const up = Array.from(healthMap.values()).filter(Boolean).length;
    return { total, up, down: healthMap.size > 0 ? total - up : 0, checking: healthMap.size === 0 };
  }, [services, healthMap]);

  function refreshHealth() {
    setHealthMap(new Map());
    setChecking(true);
    (async () => {
      const results = new Map<string, boolean>();
      await Promise.all(
        services.map(async (s) => {
          const ok = await checkHealth(s.url);
          results.set(s.slug, ok);
        }),
      );
      setHealthMap(results);
      setChecking(false);
    })();
  }

  if (loading) {
    return (
      <div className="space-y-6 p-1">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{stats.total}</span> services
            {stats.checking ? (
              <span className="text-muted-foreground/60">checking...</span>
            ) : (
              <>
                <span className="text-emerald-500">{stats.up} up</span>
                {stats.down > 0 && <span className="text-red-500">{stats.down} down</span>}
              </>
            )}
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={refreshHealth} disabled={checking}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", checking && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const isActive = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={Server} message="No services match this filter." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <ServiceCard key={s.slug} service={s} healthy={healthMap.get(s.slug)} />
          ))}
        </div>
      )}
    </div>
  );
}
