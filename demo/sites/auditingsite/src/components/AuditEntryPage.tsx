import { AuditEntry } from "../util/Types";

export default function AuditEntryPage({entry}: {entry: AuditEntry}) {
    return (
        <div id="audit-page">
            <h2>{entry.resourceId}</h2>
            <div className="text-display">
                <p>
                    {JSON.stringify(entry.contract, null, 2)}
                </p>
            </div>
        </div>
    )
}
