// A web page that lists the rows the CLI removed.
export default function ReportPage({ removed }: { removed: string[][] }) {
  return (
    <main>
      <h1>Removed rows</h1>
      <ul>{removed.map((row, index) => <li key={index}>{row.join(', ')}</li>)}</ul>
    </main>
  );
}
