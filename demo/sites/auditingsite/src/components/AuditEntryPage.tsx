import { Box, Grid, Typography } from "@mui/material";
import { AuditEntry } from "../util/Types";

export default function AuditEntryPage({entry}: {entry: AuditEntry}) {
    return (
        <div id="audit-page">
            <Typography variant="h5" style={{textAlign: "left", }}>{entry.resourceId}</Typography>
            <div className="text-display">
                <Box sx={{ width: '100%', height: '8%' }}>
                    <Typography variant="h6">Contract</Typography>
                </Box>
                <Box sx={{ width: '100%', height: '39%' }} style={{marginBottom: "1em", border: "1px solid gray"}}>
                    <p className="content-paragraph">
                        {JSON.stringify(entry.contract, null, 2)}
                    </p>
                </Box>
                <Box sx={{ width: '100%', height: '8%' }}>
                    <Typography variant="h6">Data</Typography>
                </Box>
                <Box sx={{ width: '100%', height: '39%' }} style={{marginBottom: "1em", border: "1px solid gray"}}>
                    <p className="content-paragraph">
                        {entry.data}
                    </p>
                </Box>
            </div>
        </div>
    )
}
