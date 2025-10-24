// Maps your Incident model to ServiceNow incident fields.
// Keep it minimal and safe for any vanilla dev instance.

const priorityMap = {
  // ServiceNow priorities are typically 1 (Critical) .. 5 (Planning)
  CRITICAL: "1",
  HIGH: "2",
  MEDIUM: "3",
  LOW: "4",
};

const stateMap = {
  // Common SN "state" values: 1=New, 2=In Progress, 3=On Hold, 6=Resolved, 7=Closed
  OPEN: "1",
  IN_PROGRESS: "2",
  RESOLVED: "6",
  CLOSED: "7",
};

export function toSnowFields(incident) {
  const { title, description, priority, status, assetId } = incident;
  const fields = {
    short_description: title || "(no title)",
    description: description || "",
    priority: priorityMap[priority] ?? "4",
    state: stateMap[status] ?? "1",
  };

  // If you add custom u_* fields in your SN instance later, uncomment:
  // fields.u_asset_id = assetId ?? "";
  // fields.u_lat = incident.lat ?? null;
  // fields.u_lon = incident.lon ?? null;

  return fields;
}
