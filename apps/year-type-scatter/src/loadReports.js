import csvText from "@hhcd-reports-csv";
import { parseReportsCsv } from "./parseReportsCsv.js";

export { parseReportsCsv };
export const reports = parseReportsCsv(csvText);
