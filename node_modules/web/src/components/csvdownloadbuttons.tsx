// FILE: web/src/components/csvdownloadbuttons.tsx
const CsvDownloadButtons = () => {
  const downloads = [
    { name: "Daily CSV", path: "/analytics/daily.csv" },
    { name: "By Asset CSV", path: "/analytics/by-asset.csv" },
    { name: "SLA Breaches CSV", path: "/analytics/sla.csv" },
  ];

  return (
    <div className="md-page">
      <div className="md-card">
        <div className="md-header">
          <h2 className="md-title">Download Analytics CSVs</h2>
        </div>
        <div className="md-content">
          <div className="md-grid cols-2">
            {downloads.map((dl) => (
              <a
                key={dl.path}
                href={dl.path}
                className="btn"
                download
                target="_blank"
                rel="noopener noreferrer"
              >
                {dl.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CsvDownloadButtons;
