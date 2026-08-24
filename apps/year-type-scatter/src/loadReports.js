import csvText from "@hhcd-reports-csv?raw";
import { parseReportsCsv } from "./parseReportsCsv.js";

export { parseReportsCsv };
export const reports = parseReportsCsv(csvText);
