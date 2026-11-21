import { blocks as labels } from "../../i18n/es.json";

export function ReadingsPanel({ readings, isTestMode }: {
  readings: Readonly<Record<string, number>>;
  isTestMode: boolean;
}) {
  const entries = Object.entries(readings);
  return <section className="readings-panel" aria-labelledby="readings-title">
    <div className="panel-heading"><h2 id="readings-title">{labels.readingsTitle}</h2></div>
    <p className="code-note">{isTestMode ? labels.testReadingsNotice : labels.readingsNotice}</p>
    {entries.length === 0 ? <p className="code-note">{labels.noReadings}</p> :
      <dl className="readings-list">{entries.map(([resultId, reading]) => <div key={resultId}>
        <dt>{resultId}</dt><dd>{reading.toLocaleString("es-MX", { maximumFractionDigits: 2 })} <span>cm</span></dd>
      </div>)}</dl>}
  </section>;
}
