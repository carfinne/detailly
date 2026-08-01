// Rendert strukturierte Daten (schema.org) als JSON-LD-<script>. Kein Fremdpaket.
//
// Server- UND Client-tauglich: In Server-Komponenten/Seiten landet das Markup
// direkt im statischen Export-HTML. In Client-Komponenten wird es beim Prerender
// (SSG) ebenfalls ins statische HTML geschrieben – sofern die Daten zur
// Render-Zeit feststehen (konstante Daten). Erst zur Laufzeit gefetchte Daten
// stehen NICHT im Build-HTML (siehe BetriebsVerzeichnisJsonLd).
//
// Sicherheit: '<' wird escaped, damit kein "</script>" aus den Daten den Tag
// vorzeitig schließen kann (XSS-Schutz bei dangerouslySetInnerHTML).

type JsonLdData = Record<string, unknown> | Record<string, unknown>[];

export function JsonLd({ data }: { data: JsonLdData }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export default JsonLd;
