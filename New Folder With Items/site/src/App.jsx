import { useEffect, useState } from "react";

const phoneHref = "tel:5615641545";
const phoneLabel = "561-564-1545";

const modes = {
  ac: {
    id: "ac",
    label: "AC",
    accentName: "Thermal Red",
    themeColor: "#8c1d20",
    eyebrow: "South Florida AC repair and replacement",
    headline: "Fast air conditioning service with a premium modern edge.",
    blurb:
      "When cooling fails, ASAP AC and Appliance keeps the next step simple: call, explain the issue, and get same-day urgency for diagnostics, repairs, and replacement guidance.",
    badge: "Same-day AC response",
    primaryStat: "No cool",
    primaryLabel: "diagnostics and repair",
    secondaryStat: "Airflow",
    secondaryLabel: "thermostat and drain line support",
    heroCards: [
      {
        title: "Cooling Repair",
        text: "Service for no-cool calls, frozen coils, weak airflow, noisy systems, and short cycling.",
      },
      {
        title: "Maintenance",
        text: "Routine tune-ups that help keep systems cleaner, more efficient, and more dependable.",
      },
      {
        title: "Replacement Planning",
        text: "Clear recommendations when older equipment is costing too much to keep alive.",
      },
    ],
    checklist: [
      "Residential AC diagnostics",
      "Air handler and condenser issues",
      "Thermostat, airflow, and drain line problems",
      "Fast scheduling for urgent cooling calls",
    ],
    spotlightTitle: "AC service built for urgency",
    spotlightText:
      "The red theme leans into emergency cooling calls and keeps the phone number front and center across the page.",
    heroImage: "/ac-repair-hero.jpg",
    heroImageAlt: "Technician working on an outdoor air conditioning condenser.",
    heroImageLabel: "AC repair focus",
  },
  appliances: {
    id: "appliances",
    label: "Appliances",
    accentName: "Electric Blue",
    themeColor: "#1d4ed8",
    eyebrow: "South Florida appliance repair",
    headline: "Major appliance repair with a clean, confident booking experience.",
    blurb:
      "From kitchen breakdowns to laundry room failures, ASAP AC and Appliance makes it easy to call quickly and get same-day support for the machines your home relies on.",
    badge: "Same-day appliance response",
    primaryStat: "Kitchen",
    primaryLabel: "refrigerator, oven, and dishwasher service",
    secondaryStat: "Laundry",
    secondaryLabel: "washer and dryer troubleshooting",
    heroCards: [
      {
        title: "Kitchen Appliances",
        text: "Support for refrigerators, freezers, ovens, cooktops, microwaves, and dishwashers.",
      },
      {
        title: "Laundry Repair",
        text: "Washer and dryer service for leaks, noise, spin failures, heat loss, and draining issues.",
      },
      {
        title: "Clear Next Steps",
        text: "Simple repair-versus-replace guidance so you can make a quick decision without guesswork.",
      },
    ],
    checklist: [
      "Refrigerator and freezer repairs",
      "Washer and dryer troubleshooting",
      "Oven, range, and cooktop service",
      "Dishwasher and disposal issues",
    ],
    spotlightTitle: "Appliance mode stays calm and clear",
    spotlightText:
      "The blue theme keeps the same premium layout while shifting the page toward kitchen and laundry repair needs.",
    heroImage: "/appliance-repair-handshake.jpg",
    heroImageAlt: "Appliance technician shaking hands with a customer in a kitchen.",
    heroImageLabel: "Appliance repair focus",
  },
};

const trustPoints = [
  "Premium dark modern landing page",
  "One-tap call-first layout",
  "AC and appliance service in one experience",
];

const processSteps = [
  {
    title: "Call now",
    text: "Tap any phone CTA and connect directly with ASAP AC and Appliance at 561-564-1545.",
  },
  {
    title: "Share the problem",
    text: "Explain whether the issue is AC or appliances so the right service path is prioritized immediately.",
  },
  {
    title: "Get same-day service",
    text: "The page is designed to move visitors from landing to live phone calls without friction.",
  },
];

const serviceAreas = [
  "Palm Beach",
  "West Palm Beach",
  "Boca Raton",
  "Delray Beach",
  "Boynton Beach",
  "Wellington",
];

const testimonials = [
  {
    quote:
      "Fast response, clear communication, and a much smoother service experience than we expected when the AC stopped working.",
    name: "South Florida homeowner",
  },
  {
    quote:
      "We called about an appliance issue and got a same-day visit lined up quickly without back-and-forth or confusion.",
    name: "Local customer",
  },
  {
    quote:
      "The process felt premium and simple from the first phone call. Exactly what you want when something breaks at home.",
    name: "Verified client review",
  },
];

function App() {
  const [mode, setMode] = useState("ac");
  const currentMode = modes[mode];

  useEffect(() => {
    document.title =
      mode === "ac"
        ? "ASAP AC and Appliance | AC Service"
        : "ASAP AC and Appliance | Appliance Repair";

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute("content", currentMode.themeColor);
    }
  }, [currentMode.themeColor, mode]);

  return (
    <div className={`site-shell theme-${mode}`}>
      <div className="background-grid" aria-hidden="true" />
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">{mode === "ac" ? "AC" : "AP"}</div>
          <div>
            <p className="brand-name">ASAP AC and Appliance</p>
            <p className="brand-subtitle">asapacboss.com</p>
          </div>
        </div>

        <div className="toggle-cluster" role="tablist" aria-label="Service mode">
          {Object.values(modes).map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === mode ? "toggle-pill active" : "toggle-pill"}
              onClick={() => setMode(item.id)}
              aria-pressed={item.id === mode}
            >
              {item.label}
            </button>
          ))}
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
              style={{ backgroundImage: `url(${currentMode.heroImage})` }}
            />
          </div>

          <div className="hero-copy">
            <p className="eyebrow">{currentMode.eyebrow}</p>
            <h1>{currentMode.headline}</h1>
            <p className="hero-text">{currentMode.blurb}</p>

            <div className="toggle-card">
              <div className="toggle-header">
                <span>Service Focus</span>
                <span className="accent-label">{currentMode.accentName}</span>
              </div>

              <ul className="checklist">
                {currentMode.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="hero-actions">
              <a className="primary-cta" href={phoneHref}>
                Call {phoneLabel}
              </a>
              <a className="secondary-cta" href="#same-day-service">
                Same day service
              </a>
            </div>
          </div>

          <aside className="hero-panel">
            <div className="hero-image-shell">
              <img
                className="hero-image"
                src={currentMode.heroImage}
                alt={currentMode.heroImageAlt}
              />
              <div className="hero-image-overlay" />
              <div className="hero-image-label">{currentMode.heroImageLabel}</div>
            </div>

            <div className="badge">{currentMode.badge}</div>

            <div className="stat-grid">
              <article className="stat-card">
                <strong>{currentMode.primaryStat}</strong>
                <span>{currentMode.primaryLabel}</span>
              </article>
              <article className="stat-card">
                <strong>{currentMode.secondaryStat}</strong>
                <span>{currentMode.secondaryLabel}</span>
              </article>
            </div>

            <div className="service-cards">
              {currentMode.heroCards.map((card) => (
                <article key={card.title} className="service-card">
                  <h2>{card.title}</h2>
                  <p>{card.text}</p>
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
            <p className="section-label">Why this page works</p>
            <h2>Built for quick calls, not distractions.</h2>
            <p>
              The landing page keeps the dark premium look, the phone number stays
              visible, and the AC or Appliances toggle changes the theme instantly so
              the experience feels tailored without adding friction.
            </p>
          </article>

          <article className="content-panel">
            <p className="section-label">Current mode</p>
            <h2>{currentMode.spotlightTitle}</h2>
            <p>{currentMode.spotlightText}</p>
          </article>
        </section>

        <section className="process-section">
          <p className="section-label">Simple flow</p>
          <div className="process-grid">
            {processSteps.map((step, index) => (
              <article key={step.title} className="process-card">
                <span className="step-number">0{index + 1}</span>
                <h2>{step.title}</h2>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="service-area-section">
          <article className="service-area-panel">
            <p className="section-label">Service area</p>
            <h2>Serving homes across South Florida.</h2>
            <p>
              ASAP AC and Appliance is positioned for same-day calls throughout the
              South Florida area, with fast phone-first scheduling for AC and major
              appliance service needs.
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

        <section className="reviews-section">
          <div className="reviews-heading">
            <p className="section-label">Reviews</p>
            <h2>Trusted for fast service and a clean experience.</h2>
          </div>

          <div className="reviews-grid">
            {testimonials.map((testimonial) => (
              <article key={testimonial.quote} className="review-card">
                <span className="review-stars" aria-hidden="true">
                  5.0
                </span>
                <p className="review-quote">“{testimonial.quote}”</p>
                <p className="review-name">{testimonial.name}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="same-day-panel" id="same-day-service">
          <div>
            <p className="section-label">Same-day callout</p>
            <h2>Call for same day service</h2>
            <p>
              ASAP AC and Appliance keeps urgent AC and appliance help one tap away
              for homeowners who need service now.
            </p>
          </div>

          <a className="bottom-call-button" href={phoneHref}>
            Call {phoneLabel}
          </a>
        </section>

        <section className="final-cta-section">
          <div className="final-cta-panel">
            <p className="section-label">Ready to call</p>
            <h2>AC problem or appliance breakdown, call now and keep it moving.</h2>
            <p>
              ASAP AC and Appliance keeps the next step simple with a premium,
              straightforward landing page built to turn visits into live calls.
            </p>

            <div className="hero-actions">
              <a className="primary-cta" href={phoneHref}>
                Call {phoneLabel}
              </a>
              <a className="secondary-cta" href="#same-day-service">
                Same day service
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
