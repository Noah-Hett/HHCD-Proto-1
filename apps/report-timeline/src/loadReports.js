import csvText from "../../../data/reports.csv?raw";
import { parseReports, yearRangeOf } from "./parseReports.js";

export const reports = parseReports(csvText);
export const yearRange = yearRangeOf(reports);
