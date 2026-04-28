import { useEffect } from "react";

const phoneHref = "tel:5615641545";
const phoneLabel = "561-564-1545";

const services = [
  "Washer repair",
  "Dryer repair",
  "Refrigerator repair",
  "Oven repair",
  "Stove repair",
  "Dishwasher repair",
];

const serviceAreas = [
  "Palm Beach",
  "West Palm Beach",
  "Boca Raton",
  "Delray Beach",
  "Boynton Beach",
  "Wellington",
];

const trustPoints = [
  "Appliance-only repair service",
  "Same-day scheduling when available",
  "Call-first booking at 561-564-1545",
];

function App() {
  useEffect(() => {
    document.title = "ASAP Appliance | Appliance Repair Service";

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute("content", "#1d4ed8");
    }
  }, []);

  return (
    <div className="site-shell theme-appliances">
      <div className="background-grid" aria-hidden="true" />
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">AP</div>
          <div>
            <p className="brand-name">ASAP Appliance</p>
            <p className="brand-subtitle">asapacboss.com</p>
          </div>
        </div>

        <a className="call-button" href={phoneHref}>
          Call {phoneLabel}
        </a>
      </header>

      <main>
        <section className="hero">
          <div className="hero-scene" aria-hidden="true">
            <div
              className="hero-scene-image"
              style={{ backgroundImage: "url(/appliance-repair-handshake.jpg)" }}
            />
          </div>

          <div className="hero-copy">
            <p className="eyebrow">South Florida appliance repair</p>
            <h1>Appliance Repair Service</h1>
            <p className="hero-text">
              ASAP Appliance helps homeowners schedule repair service for major
              household appliances with a simple phone-first booking experience.
            </p>

            <div className="toggle-card">
              <div className="toggle-header">
                <span>DBA / Google Profile Name</span>
                <span className="accent-label">ASAP Appliance</span>
              </div>

              <ul className="checklist">
                {services.map((service) => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
            </div>

            <div className="hero-actions">
              <a className="primary-cta" href={phoneHref}>
                Call {phoneLabel}
              </a>
              <a className="secondary-cta" href="#services">
                View services
              </a>
            </div>
          </div>

          <aside className="hero-panel">
            <div className="hero-image-shell">
              <img
                className="hero-image"
                src="/appliance-repair-handshake.jpg"
                alt="Appliance repair technician greeting a customer in a kitchen."
              />
              <div className="hero-image-overlay" />
              <div className="hero-image-label">Appliance repair service</div>
            </div>

            <div className="badge">Appliance-only service page</div>

            <div className="stat-grid">
              <article className="stat-card">
                <strong>Kitchen</strong>
                <span>refrigerator, oven, stove, and dishwasher repair</span>
              </article>
              <article className="stat-card">
                <strong>Laundry</strong>
                <span>washer and dryer troubleshooting</span>
              </article>
            </div>

            <div className="service-cards" id="services">
              {services.map((service) => (
                <article key={service} className="service-card">
                  <h2>{service}</h2>
                  <p>Call ASAP Appliance to request service and share what is not working.</p>
                </article>
              ))}
            </div>

            <a className="panel-call-link" href={phoneHref}>
              Call {phoneLabel}
            </a>
          </aside>
        </section>

        <section className="trust-strip" aria-label="Trust points">
          {trustPoints.map((point) => (
            <div key={point} className="trust-chip">
              {point}
            </div>
          ))}
        </section>

        <section className="content-grid">
          <article className="content-panel">
            <p className="section-label">Business profile</p>
            <h2>ASAP Appliance</h2>
            <p>
              This website is set up for appliance repair service under the name
              ASAP Appliance, with clear service categories and a direct phone number.
            </p>
          </article>

          <article className="content-panel">
            <p className="section-label">Services listed</p>
            <h2>Major household appliance repair.</h2>
            <p>
              Washer, dryer, refrigerator, oven, stove, and dishwasher repair are
              the only services presented on this public website.
            </p>
          </article>
        </section>

        <section className="service-area-section">
          <article className="service-area-panel">
            <p className="section-label">Service area</p>
            <h2>Serving homes across South Florida.</h2>
            <p>
              Call ASAP Appliance for appliance repair scheduling in the local
              South Florida service area.
            </p>

            <div className="service-area-chips" aria-label="South Florida service areas">
              {serviceAreas.map((area) => (
                <span key={area} className="service-area-chip">
                  {area}
                </span>
              ))}
            </div>
          </article>
        </section>

        <section className="same-day-panel" id="same-day-service">
          <div>
            <p className="section-label">Call to schedule</p>
            <h2>Appliance repair help is one tap away.</h2>
            <p>Call the business line and explain which appliance needs service.</p>
          </div>

          <a className="bottom-call-button" href={phoneHref}>
            Call {phoneLabel}
          </a>
        </section>

        <section className="final-cta-section">
          <div className="final-cta-panel">
            <p className="section-label">Legal</p>
            <h2>CASE-LESS INDUSTRIES LLC DBA ASAP Appliance</h2>
            <p>Public website for appliance repair service requests at asapacboss.com.</p>

            <div className="hero-actions">
              <a className="primary-cta" href={phoneHref}>
                Call {phoneLabel}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        ASAP Appliance is a trade name of CASE-LESS INDUSTRIES LLC.{" "}
        <a href="/confirmations/">SMS opt-in confirmation</a>
      </footer>
    </div>
  );
}

export default App;
