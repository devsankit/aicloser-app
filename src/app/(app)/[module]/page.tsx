import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { MODULES, moduleBySlug } from "@/lib/modules";

export function generateStaticParams() {
  return MODULES.map((m) => ({ module: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string }>;
}): Promise<Metadata> {
  const { module } = await params;
  const spec = moduleBySlug(module);
  return { title: spec?.title ?? "Not found" };
}

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const spec = moduleBySlug(module);
  if (!spec) notFound();

  return (
    <div className="module">
      <header className="module-head">
        <span className="module-icon">
          <Icon name={spec.icon} size={19} />
        </span>
        <div>
          <h1 className="page-title">{spec.title}</h1>
          <p className="page-sub">{spec.blurb}</p>
        </div>
      </header>

      <div className="module-grid">
        <section className="card">
          <div className="card-head">
            <span className="card-title">What this screen does</span>
            <span className="chip" style={{ marginLeft: "auto" }}>
              UI specced
            </span>
          </div>
          <div className="card-body">
            <ul className="feature-list">
              {spec.features.map((f) => (
                <li key={f}>
                  <Icon name="check" size={14} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <span className="card-title">Waiting on</span>
          </div>
          <div className="card-body">
            <div className="api-note">
              <p>
                <strong>Backend contract.</strong> {spec.api}
              </p>
              <p className="hint">
                The layout, tokens and states here are final. When the endpoint exists, this page
                swaps its placeholder body for live data — no restyle needed.
              </p>
              <span className="chip" data-tone="warning">
                <span className="dot" /> Not connected
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
