import { useEffect, useMemo, useState } from "react";

const phoneHref = "tel:5615641545";
const phoneLabel = "561-564-1545";
const hostedOperationsApiUrl = "https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm";

const services = [
  "Washer repair",
  "Dryer repair",
  "Refrigerator repair",
  "Oven repair",
  "Stove repair",
  "Dishwasher repair",
];

const applianceOptions = [
  "Washer",
  "Dryer",
  "Refrigerator",
  "Oven",
  "Stove",
  "Dishwasher",
  "Other appliance",
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

const initialServiceRequest = {
  name: "",
  phone: "",
  serviceAddress: "",
  applianceType: "",
  issueSummary: "",
  preferredTiming: "",
  smsConsent: false,
};

const smsConsentCopy =
  "I agree to receive SMS messages from ASAP Appliance at the phone number I provided about scheduling, appointment updates, technician ETA, estimates, invoices, and service follow-ups. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.";

function getOperationsApiUrl(pathname) {
  const configuredBaseUrl =
    import.meta.env.VITE_PUBLIC_SERVICE_REQUEST_API_URL?.trim() ||
    import.meta.env.VITE_LOCAL_OPERATIONS_SERVER_URL?.trim() ||
    "";

  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/$/u, "")}${pathname}`;
  }

  if (!import.meta.env.DEV) {
    return `${hostedOperationsApiUrl}${pathname}`;
  }

  return `http://127.0.0.1:8787${pathname}`;
}

function validateServiceRequest(values) {
  const errors = {};

  if (!values.name.trim()) {
    errors.name = "Enter your name.";
  }

  if (!values.phone.trim()) {
    errors.phone = "Enter your phone number.";
  }

  if (!values.serviceAddress.trim()) {
    errors.serviceAddress = "Enter the service address.";
  }

  if (!values.applianceType.trim()) {
    errors.applianceType = "Choose the appliance type.";
  }

  if (!values.issueSummary.trim()) {
    errors.issueSummary = "Tell us what is not working.";
  }

  if (!values.preferredTiming.trim()) {
    errors.preferredTiming = "Enter your preferred timing.";
  }

  if (!values.smsConsent) {
    errors.smsConsent = "Please check the SMS consent box before submitting.";
  }

  return errors;
}

function App() {
  const [formValues, setFormValues] = useState(initialServiceRequest);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitState, setSubmitState] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const serviceRequestUrl = useMemo(() => getOperationsApiUrl("/api/service-requests"), []);
  const isSubmitting = submitState === "submitting";

  useEffect(() => {
    document.title = "ASAP Appliance | Appliance Repair Service";

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute("content", "#1d4ed8");
    }
  }, []);

  function updateField(fieldName, value) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
    setFieldErrors((currentErrors) => {
      if (!currentErrors[fieldName]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validateServiceRequest(formValues);
    setFieldErrors(nextErrors);
    setSubmitMessage("");

    if (Object.keys(nextErrors).length > 0) {
      setSubmitState("error");
      setSubmitMessage("Please complete the required fields before submitting.");
      return;
    }

    setSubmitState("submitting");

    try {
      const response = await fetch(serviceRequestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formValues,
          dryRun: import.meta.env.DEV || import.meta.env.VITE_PUBLIC_SERVICE_REQUEST_DRY_RUN === "true",
        }),
      });
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.ok) {
        setFieldErrors(responseJson?.fieldErrors || {});
        throw new Error(responseJson?.message || "Service request could not be submitted.");
      }

      setSubmitState("success");
      setSubmitMessage(
        responseJson.dryRun
          ? "Dry run received. The form is wired correctly and no live lead was created."
          : "Thanks. ASAP Appliance received your request and will follow up by phone or service text.",
      );
      setFormValues(initialServiceRequest);
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage(
        error instanceof Error
          ? error.message
          : "Service request could not be submitted. Please call ASAP Appliance.",
      );
    }
  }

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
              Call ASAP Appliance first for urgent help, or send the service request form
              and the office will follow up about scheduling, technician timing, and next steps.
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
              <a className="secondary-cta" href="#service-request-form">
                Request service
              </a>
            </div>
          </div>

          <aside className="request-panel" id="service-request-form">
            <p className="section-label">Service request</p>
            <h2>Tell us what needs repair.</h2>
            <p className="request-intro">
              Phone calls are fastest. This form sends your request to the office queue for
              appliance repair follow-up.
            </p>

            <form className="request-form" noValidate onSubmit={handleSubmit}>
              <div className="form-row">
                <label className="field" htmlFor="request-name">
                  Name
                  <input
                    aria-describedby={fieldErrors.name ? "request-name-error" : undefined}
                    aria-invalid={Boolean(fieldErrors.name)}
                    autoComplete="name"
                    id="request-name"
                    name="name"
                    onChange={(event) => updateField("name", event.target.value)}
                    type="text"
                    value={formValues.name}
                  />
                  {fieldErrors.name ? (
                    <span className="field-error" id="request-name-error">
                      {fieldErrors.name}
                    </span>
                  ) : null}
                </label>

                <label className="field" htmlFor="request-phone">
                  Phone
                  <input
                    aria-describedby={fieldErrors.phone ? "request-phone-error" : undefined}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    autoComplete="tel"
                    id="request-phone"
                    inputMode="tel"
                    name="phone"
                    onChange={(event) => updateField("phone", event.target.value)}
                    type="tel"
                    value={formValues.phone}
                  />
                  {fieldErrors.phone ? (
                    <span className="field-error" id="request-phone-error">
                      {fieldErrors.phone}
                    </span>
                  ) : null}
                </label>
              </div>

              <label className="field" htmlFor="request-address">
                Service address
                <input
                  aria-describedby={fieldErrors.serviceAddress ? "request-address-error" : undefined}
                  aria-invalid={Boolean(fieldErrors.serviceAddress)}
                  autoComplete="street-address"
                  id="request-address"
                  name="serviceAddress"
                  onChange={(event) => updateField("serviceAddress", event.target.value)}
                  placeholder="Street, city, ZIP"
                  type="text"
                  value={formValues.serviceAddress}
                />
                {fieldErrors.serviceAddress ? (
                  <span className="field-error" id="request-address-error">
                    {fieldErrors.serviceAddress}
                  </span>
                ) : null}
              </label>

              <div className="form-row">
                <label className="field" htmlFor="request-appliance">
                  Appliance type
                  <select
                    aria-describedby={fieldErrors.applianceType ? "request-appliance-error" : undefined}
                    aria-invalid={Boolean(fieldErrors.applianceType)}
                    id="request-appliance"
                    name="applianceType"
                    onChange={(event) => updateField("applianceType", event.target.value)}
                    value={formValues.applianceType}
                  >
                    <option value="">Choose appliance</option>
                    {applianceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.applianceType ? (
                    <span className="field-error" id="request-appliance-error">
                      {fieldErrors.applianceType}
                    </span>
                  ) : null}
                </label>

                <label className="field" htmlFor="request-timing">
                  Preferred timing
                  <input
                    aria-describedby={fieldErrors.preferredTiming ? "request-timing-error" : undefined}
                    aria-invalid={Boolean(fieldErrors.preferredTiming)}
                    id="request-timing"
                    name="preferredTiming"
                    onChange={(event) => updateField("preferredTiming", event.target.value)}
                    placeholder="Today, tomorrow, morning..."
                    type="text"
                    value={formValues.preferredTiming}
                  />
                  {fieldErrors.preferredTiming ? (
                    <span className="field-error" id="request-timing-error">
                      {fieldErrors.preferredTiming}
                    </span>
                  ) : null}
                </label>
              </div>

              <label className="field" htmlFor="request-issue">
                Issue summary
                <textarea
                  aria-describedby={fieldErrors.issueSummary ? "request-issue-error" : undefined}
                  aria-invalid={Boolean(fieldErrors.issueSummary)}
                  id="request-issue"
                  name="issueSummary"
                  onChange={(event) => updateField("issueSummary", event.target.value)}
                  placeholder="Example: refrigerator not cooling, washer leaking, dryer not heating..."
                  value={formValues.issueSummary}
                />
                {fieldErrors.issueSummary ? (
                  <span className="field-error" id="request-issue-error">
                    {fieldErrors.issueSummary}
                  </span>
                ) : null}
              </label>

              <label className="consent-field" htmlFor="request-sms-consent">
                <input
                  aria-describedby={fieldErrors.smsConsent ? "request-sms-error" : "request-sms-copy"}
                  aria-invalid={Boolean(fieldErrors.smsConsent)}
                  checked={formValues.smsConsent}
                  id="request-sms-consent"
                  name="smsConsent"
                  onChange={(event) => updateField("smsConsent", event.target.checked)}
                  type="checkbox"
                />
                <span className="consent-copy" id="request-sms-copy">
                  {smsConsentCopy}
                </span>
              </label>
              {fieldErrors.smsConsent ? (
                <span className="field-error consent-error" id="request-sms-error">
                  {fieldErrors.smsConsent}
                </span>
              ) : null}

              <div className="form-submit-row">
                <button className="submit-button" disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Sending request..." : "Submit service request"}
                </button>
                <a className="inline-call-link" href={phoneHref}>
                  Or call {phoneLabel}
                </a>
              </div>

              {submitMessage ? (
                <div className={`form-status ${submitState}`} role="status" aria-live="polite">
                  {submitMessage}
                </div>
              ) : null}
            </form>
          </aside>
        </section>

        <section className="trust-strip" aria-label="Trust points">
          {trustPoints.map((point) => (
            <div key={point} className="trust-chip">
              {point}
            </div>
          ))}
        </section>

        <section className="services-section" id="services">
          <div className="services-heading">
            <p className="section-label">Services listed</p>
            <h2>Major household appliance repair.</h2>
          </div>
          <div className="service-cards-grid">
            {services.map((service) => (
              <article key={service} className="service-card">
                <h2>{service}</h2>
                <p>Call ASAP Appliance or submit the service request form to describe what is not working.</p>
              </article>
            ))}
          </div>
        </section>

        <section className="content-grid">
          <article className="content-panel">
            <p className="section-label">Business profile</p>
            <h2>ASAP Appliance</h2>
            <p>
              This website is set up for appliance repair service under the name
              ASAP Appliance, with clear service categories, a direct phone number,
              and an online service request form for customers who opt in to service texts.
            </p>
          </article>

          <article className="content-panel">
            <p className="section-label">How requests work</p>
            <h2>Call first, or send the request form.</h2>
            <p>
              The office receives the appliance type, issue, service address, preferred timing,
              and SMS consent record before following up about scheduling.
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
            <p>Call the business line for the fastest scheduling response.</p>
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
              <a className="secondary-cta" href="#service-request-form">
                Request service
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        ASAP Appliance is a trade name of CASE-LESS INDUSTRIES LLC.{" "}
        <a href="/confirmations/">SMS opt-in confirmation</a>
        <span aria-hidden="true"> | </span>
        <a href="/privacy-policy/">Privacy Policy</a>
        <span aria-hidden="true"> | </span>
        <a href="/terms-and-conditions/">Terms and Conditions</a>
      </footer>
    </div>
  );
}

export default App;
